"""`GET /app/signals*` without the capability `signals_global`: the bounded merge."""

from __future__ import annotations

import uuid

from sqlalchemy import text

from scout_bff.signals.csv_export import EXPORT_COLUMNS
from tests.pipeline_fixtures import (
    JOB_ANALYSING,
    JOB_COMPLETED,
    JOBS,
    OPERATOR_KEY,
    READER_KEY,
)


def signal_calls(pipeline) -> list[str]:
    return [
        call.request.url.path
        for call in pipeline.calls
        if call.request.url.path.endswith("/signals")
    ]


async def test_merges_the_recent_jobs_sorted_and_flagged_degraded(
    operator_client, pipeline
):
    response = await operator_client.get("/app/signals")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["degraded"] is True
    assert body["scanned_jobs"] == len(JOBS)
    assert body["truncated"] is False
    assert body["next_cursor"] is None
    rows = body["items"]
    assert [row["company"] for row in rows] == [
        "Lakeview Builders Group",
        "Central Florida Concrete",
        "Peachtree Distribution",
        "City of Winter Garden",
    ]
    peachtree = rows[2]
    assert peachtree["job_id"] == JOB_COMPLETED
    assert peachtree["county"] == "Fulton" and peachtree["state_code"] == "GA"
    assert peachtree["job_industry"] == "Wholesale Trade"
    assert peachtree["job_created_at"] == "2026-10-02T09:30:00+00:00"
    # one /signals read per scanned job, each with the operator key
    paths = signal_calls(pipeline)
    assert len(paths) == len(JOBS)
    assert all(
        call.request.headers["X-API-Key"] == OPERATOR_KEY
        for call in pipeline.calls
        if call.request.url.path.endswith("/signals")
    )


async def test_job_filters_narrow_the_scanned_jobs(operator_client, pipeline):
    response = await operator_client.get("/app/signals", params={"state": "ga"})
    body = response.json()
    assert body["scanned_jobs"] == 1
    assert [row["company"] for row in body["items"]] == ["Peachtree Distribution"]
    seen = len(signal_calls(pipeline))
    response = await operator_client.get(
        "/app/signals", params={"job_industry": "Construction", "county": "Orange"}
    )
    body = response.json()
    assert body["scanned_jobs"] == 1
    assert len(body["items"]) == 3
    assert signal_calls(pipeline)[seen:] == [f"/v1/jobs/{JOB_ANALYSING}/signals"]


async def test_job_id_and_batch_filters(operator_client, pipeline, engine):
    response = await operator_client.get(
        "/app/signals", params={"job_id": JOB_COMPLETED}
    )
    assert response.json()["scanned_jobs"] == 1
    assert [r["company"] for r in response.json()["items"]] == [
        "Peachtree Distribution"
    ]

    unknown = str(uuid.uuid4())
    response = await operator_client.get("/app/signals", params={"job_id": unknown})
    assert response.status_code == 200
    assert response.json()["items"] == [] and response.json()["scanned_jobs"] == 0

    batch_id = str(uuid.uuid4())
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO ui.batches (id, requested) "
                "VALUES (CAST(:id AS uuid), '{}'::jsonb)"
            ),
            {"id": batch_id},
        )
        for position, job_id in enumerate((JOB_ANALYSING, JOB_COMPLETED)):
            await connection.execute(
                text(
                    "INSERT INTO ui.batch_jobs "
                    "(batch_id, position, industry, job_id, client_reference) "
                    "VALUES (CAST(:batch AS uuid), :position, 'x', "
                    "CAST(:job AS uuid), :reference)"
                ),
                {
                    "batch": batch_id,
                    "position": position,
                    "job": job_id,
                    "reference": f"ui:{batch_id}:{position}",
                },
            )
    response = await operator_client.get("/app/signals", params={"batch_id": batch_id})
    body = response.json()
    assert body["scanned_jobs"] == 2 and len(body["items"]) == 4


async def test_pass_through_row_filters_and_free_text(operator_client, pipeline):
    response = await operator_client.get("/app/signals", params={"materiality": "high"})
    assert len(response.json()["items"]) == 2
    forwarded = [
        call.request.url.params.get("materiality")
        for call in pipeline.calls
        if call.request.url.path.endswith("/signals")
    ]
    assert forwarded and all(value == "high" for value in forwarded)

    response = await operator_client.get(
        "/app/signals", params={"industry": "Manufacturing"}
    )
    assert [r["company"] for r in response.json()["items"]] == [
        "Central Florida Concrete"
    ]
    response = await operator_client.get(
        "/app/signals", params={"date_after": "2026-09-30", "date_before": "2026-10-01"}
    )
    assert [r["date"] for r in response.json()["items"]] == ["2026-10-01", "2026-09-30"]
    response = await operator_client.get("/app/signals", params={"q": "STREETSCAPE"})
    assert [r["company"] for r in response.json()["items"]] == ["City of Winter Garden"]
    response = await operator_client.get("/app/signals", params={"revenue_bin": "NA"})
    assert len(response.json()["items"]) == 1


async def test_offset_cursor_pages_and_cache(operator_client, pipeline):
    first = (await operator_client.get("/app/signals", params={"limit": 3})).json()
    assert len(first["items"]) == 3 and first["next_cursor"]
    calls_after_first = len(signal_calls(pipeline))
    second = (
        await operator_client.get(
            "/app/signals", params={"limit": 3, "after": first["next_cursor"]}
        )
    ).json()
    assert [r["company"] for r in second["items"]] == ["City of Winter Garden"]
    assert second["next_cursor"] is None
    # the second page came from the 30 s cache: no new /signals reads
    assert len(signal_calls(pipeline)) == calls_after_first

    tampered = await operator_client.get(
        "/app/signals",
        params={"limit": 3, "state": "GA", "after": first["next_cursor"]},
    )
    assert tampered.status_code == 400
    assert tampered.json()["error_category"] == "invalid_cursor"


async def test_rejects_unknown_filters_and_bad_values(operator_client):
    response = await operator_client.get("/app/signals", params={"colour": "x"})
    assert response.status_code == 422
    assert response.json()["error_category"] == "unknown_filter"
    response = await operator_client.get("/app/signals", params={"limit": 500})
    assert response.status_code == 422
    response = await operator_client.get("/app/signals", params={"date_after": "x"})
    assert response.status_code == 422


async def test_viewer_reads_with_the_reader_key(viewer_client, pipeline):
    response = await viewer_client.get("/app/signals")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 4
    keys = {
        call.request.headers["X-API-Key"]
        for call in pipeline.calls
        if call.request.url.path.startswith("/v1/")
    }
    assert keys == {READER_KEY}


async def test_summary_over_the_same_bounded_set(viewer_client):
    response = await viewer_client.get("/app/signals/summary")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["signals"] == 4 and body["companies"] == 4 and body["jobs"] == 2
    assert body["by_materiality"] == {"high": 2, "medium": 1, "low": 1}
    assert body["top_signal"] == {
        "key": "operational_capacity_expansion",
        "title": "Operational Capacity Expansion",
        "count": 2,
    }
    assert body["degraded"] is True and body["scanned_jobs"] == len(JOBS)
    filtered = await viewer_client.get(
        "/app/signals/summary", params={"state": "FL", "limit": 5}
    )
    assert filtered.json()["signals"] == 3 and filtered.json()["jobs"] == 1


async def test_export_streams_csv_with_the_job_columns(viewer_client):
    async with viewer_client.stream(
        "GET", "/app/signals/export.csv", params={"state": "GA"}
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert response.headers["content-disposition"] == (
            'attachment; filename="signals.csv"'
        )
        chunks = [chunk async for chunk in response.aiter_bytes()]
    text = b"".join(chunks).decode()
    lines = text.split("\r\n")
    assert lines[0] == ",".join(EXPORT_COLUMNS)
    assert len(lines) == 3 and lines[2] == ""
    assert lines[1].startswith("4,")
    assert lines[1].endswith(f",{JOB_COMPLETED},Fulton,GA,Wholesale Trade")
    assert '"{""verbatim"":true,""name_grounded"":true}"' in lines[1]


async def test_anonymous_requests_are_rejected(client):
    for path in ("/app/signals", "/app/signals/summary", "/app/signals/export.csv"):
        response = await client.get(path)
        assert response.status_code == 401
