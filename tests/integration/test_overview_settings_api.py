"""B4 aggregates against the stub pipeline: overview, attention, system, queue, prefs."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from tests.conftest import fetch_all
from tests.pipeline_fixtures import (
    DEAD_TASK_ID,
    JOB_ANALYSING,
    JOB_DISCOVERING,
    JOB_FAILED,
    JOB_PARTIAL,
    JOB_QUEUED,
    READER_KEY,
)
from tests.pipeline_stub import PipelineStub
from tests.pipeline_stub_b4 import PipelineStubWithGlobalTasks

NON_TERMINAL = {JOB_ANALYSING, JOB_DISCOVERING, JOB_QUEUED}


@pytest.fixture
def pipeline(request) -> PipelineStub:
    """Overrides the conftest stub; `indirect` parametrisation picks the capability stub."""
    stub_class = getattr(request, "param", PipelineStub)
    return stub_class()


def rebase_clock(pipeline: PipelineStub) -> datetime:
    """Move the fixture timestamps next to the real clock so day windows are stable."""
    now = datetime.now(timezone.utc)
    ages_days = {
        JOB_ANALYSING: 0,
        JOB_DISCOVERING: 0,
        JOB_QUEUED: 0,
        JOB_PARTIAL: 1,
        JOB_FAILED: 3,
    }
    for job_id, days in ages_days.items():
        pipeline.state["jobs"][job_id]["created_at"] = (
            now - timedelta(days=days, minutes=30)
        ).isoformat()
    today = now.date()
    for offset, row in zip((2, 1, 0), pipeline.state["daily"], strict=True):
        row["day"] = (today - timedelta(days=offset)).isoformat()
    heartbeats = {"api-1": 500, "finder-1": 5, "analysis-1": 47}
    for worker in pipeline.state["workers"]:
        worker["last_seen"] = (
            now - timedelta(seconds=heartbeats[worker["instance_id"]])
        ).isoformat()
    return now


async def seed_scout_batch(engine, job_ids: list[str]) -> None:
    scout_id, batch_id = uuid.uuid4(), uuid.uuid4()
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO ui.scouts(id, name, kind, county, state_code, industries, "
                "source_mode) VALUES (:id, 'Orange County builders', "
                "'location_industry', 'Orange', 'FL', '{Construction}', 'finder')"
            ),
            {"id": scout_id},
        )
        await connection.execute(
            text(
                "INSERT INTO ui.batches(id, scout_id, run_number, requested) "
                "VALUES (:id, :scout_id, 7, '{}'::jsonb)"
            ),
            {"id": batch_id, "scout_id": scout_id},
        )
        for position, job_id in enumerate(job_ids):
            await connection.execute(
                text(
                    "INSERT INTO ui.batch_jobs(batch_id, position, industry, job_id, "
                    "client_reference) VALUES (:batch_id, :position, 'x', :job_id, :ref)"
                ),
                {
                    "batch_id": batch_id,
                    "position": position,
                    "job_id": job_id,
                    "ref": f"ui:{batch_id}:{position}",
                },
            )


def invalidate(app) -> None:
    app.state.b4_ttl_cache.invalidate()


async def test_overview_tiles(operator_client, pipeline, engine, app):
    rebase_clock(pipeline)
    await seed_scout_batch(engine, [JOB_ANALYSING, JOB_DISCOVERING])
    response = await operator_client.get("/app/overview")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["running_jobs"] == {
        "total": 3,
        "by_status": {
            "queued": 1,
            "finding": 0,
            "exploring": 0,
            "discovering": 1,
            "analysing": 1,
            "finalizing": 0,
        },
        "scouts": 1,
    }
    signals = body["signals_7d"]
    assert signals["count"] == 20 * (3 + 2 + 4) and signals["delta_pct"] is None
    assert len(signals["series"]) == 14 and signals["series"][-3:] == [60, 40, 80]
    cost = body["cost_today"]
    assert cost["usd"] == 11.6 and cost["delta_usd"] == 5.8
    assert cost["cost_complete"] is True and len(cost["series"]) == 14
    assert body["dead_tasks"] == {
        "count": 2,
        "new_since_yesterday": 1,
        "basis": "daily_stats",
    }
    # cached for 10 s: a second read makes no further pipeline calls
    calls_before = len(pipeline.calls)
    assert (await operator_client.get("/app/overview")).json() == body
    assert len(pipeline.calls) == calls_before


async def test_active_runs_carry_progress_cost_and_sites(operator_client, pipeline):
    rebase_clock(pipeline)
    response = await operator_client.get("/app/overview/active-runs")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert {row["id"] for row in items} == NON_TERMINAL
    assert [row["id"] for row in items][0] in NON_TERMINAL  # newest first, all today
    analysing = next(row for row in items if row["id"] == JOB_ANALYSING)
    assert analysing["progress"]["signals"] == 24
    assert analysing["cost_usd"] == 1.21 and analysing["cost_complete"] is True
    # the stub has no site-runs route: the seed count is known, the done count is not
    assert analysing["sites"] == {"done": None, "total": 5}
    assert "costs" not in analysing


async def test_viewer_reads_overview_with_the_reader_key(viewer_client, pipeline):
    rebase_clock(pipeline)
    assert (await viewer_client.get("/app/overview")).status_code == 200
    job_calls = [call for call in pipeline.calls if call.request.url.path == "/v1/jobs"]
    assert job_calls and all(
        call.request.headers["X-API-Key"] == READER_KEY for call in job_calls
    )


async def test_attention_items_fallback_mode(operator_client, pipeline, app):
    rebase_clock(pipeline)
    response = await operator_client.get("/app/attention")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    kinds = [(row["kind"], row["severity"]) for row in items]
    assert kinds == [
        ("dead_task", "fail"),
        ("failed_job", "fail"),
        ("slow_worker", "fail"),
        ("partial_job", "warn"),
        ("slow_worker", "warn"),
    ]
    dead = items[0]
    assert dead["title"] == "1 dead task · analyze_article"
    assert dead["detail"] == (
        "saved_content_unavailable · Orange County, FL · Construction"
    )
    assert dead["href"] == f"/jobs/{JOB_ANALYSING}/tasks"
    assert dead["task_id"] == DEAD_TASK_ID and dead["job_id"] == JOB_ANALYSING
    assert items[1]["href"] == f"/jobs/{JOB_FAILED}"
    assert items[2]["instance_id"] == "api-1"
    assert items[2]["href"] == "/settings/workers#api-1"
    partial = items[3]
    assert partial["detail"].endswith("stopped on site_time_limit · resume?")
    assert partial["href"] == f"/jobs/{JOB_PARTIAL}"
    slow = items[4]
    assert slow["instance_id"] == "analysis-1"
    assert slow["title"] == "analysis-1 heartbeat is slow"
    assert not any(call.request.url.path == "/v1/tasks" for call in pipeline.calls)

    pipeline.ready = False
    invalidate(app)
    degraded = (await operator_client.get("/app/attention")).json()["items"]
    assert degraded[0]["kind"] == "api_not_ready"
    assert degraded[0]["severity"] == "fail"
    assert degraded[0]["href"] == "/settings/system"
    assert "migrations" in degraded[0]["detail"]

    pipeline.down = True
    invalidate(app)
    down = await operator_client.get("/app/attention")
    assert down.status_code == 200
    assert down.json()["items"] == [
        {
            "kind": "api_not_ready",
            "severity": "fail",
            "title": "Pipeline API is not ready",
            "detail": "The pipeline API is unavailable.",
            "href": "/settings/system",
        }
    ]


@pytest.mark.parametrize("pipeline", [PipelineStubWithGlobalTasks], indirect=True)
async def test_attention_uses_the_global_task_list_when_capable(
    operator_client, pipeline
):
    rebase_clock(pipeline)
    assert operator_client.me["capabilities"]["tasks_global"] is True
    items = (await operator_client.get("/app/attention")).json()["items"]
    dead = [row for row in items if row["kind"] == "dead_task"]
    assert len(dead) == 1 and dead[0]["task_id"] == DEAD_TASK_ID
    task_calls = [
        call for call in pipeline.calls if call.request.url.path == "/v1/tasks"
    ]
    assert task_calls and task_calls[0].request.url.params["status"] == "dead"
    assert not any(
        call.request.url.path.endswith("/tasks")
        and call.request.url.path != "/v1/tasks"
        for call in pipeline.calls
    )


async def test_system_info(operator_client, pipeline, app):
    rebase_clock(pipeline)
    response = await operator_client.get("/app/system")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["bff"]["version"] == "0.1.0"
    assert body["bff"]["migrations_head"] == "0001_ui_schema"
    assert body["bff"]["started_at"]
    pipeline_info = body["pipeline"]
    assert pipeline_info["url_host"] == "pipeline-stub.test"
    assert pipeline_info["ready"] is True
    assert pipeline_info["checks"] == {
        "database": True,
        "artifact_store": True,
        "migrations": True,
    }
    assert pipeline_info["version"] == "1.0.0"
    assert pipeline_info["prompt_version"] == "2026.10"
    assert body["capabilities"]["tasks_global"] is False
    assert body["capabilities"]["probe_error"] is None
    assert body["model_prices"] is None
    assert any("Model prices" in note for note in body["notes"])

    pipeline.ready = False
    invalidate(app)
    degraded = (await operator_client.get("/app/system")).json()["pipeline"]
    assert degraded["ready"] is False and degraded["checks"]["migrations"] is False


async def test_queue_summary_falls_back_to_recent_jobs(operator_client, pipeline):
    rebase_clock(pipeline)
    response = await operator_client.get("/app/system/queue")
    assert response.status_code == 200, response.text
    assert response.json() == {
        "queued": 27,
        "running": 6,
        "failed": None,
        "dead": 1,
        "basis": "recent_jobs",
        "jobs_scanned": 3,
        "generated_at": response.json()["generated_at"],
    }


@pytest.mark.parametrize("pipeline", [PipelineStubWithGlobalTasks], indirect=True)
async def test_queue_summary_with_tasks_global(operator_client, pipeline):
    rebase_clock(pipeline)
    body = (await operator_client.get("/app/system/queue")).json()
    assert body["basis"] == "api" and body["jobs_scanned"] == 0
    assert (body["queued"], body["running"], body["failed"], body["dead"]) == (
        1,
        1,
        0,
        1,
    )


async def test_dead_by_category_and_maintenance(operator_client, pipeline):
    rebase_clock(pipeline)
    response = await operator_client.get("/app/system/dead-by-category?days=7")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["days"] == 7 and body["total"] == 2
    assert body["items"] == [{"category": "model_rate_limited", "count": 2, "pct": 100}]
    assert (
        await operator_client.get("/app/system/dead-by-category?days=0")
    ).status_code == 422
    maintenance = (await operator_client.get("/app/system/maintenance")).json()
    assert [row["name"] for row in maintenance["items"]][:2] == [
        "sweep_jobs",
        "expire_artifacts",
    ]
    assert maintenance["items"][0]["last_result"] is None


async def test_prefs_round_trip_and_validation(operator_client, engine):
    defaults = await operator_client.get("/app/prefs")
    assert defaults.status_code == 200
    assert defaults.json() == {
        "theme": "system",
        "density": "comfortable",
        "time_display": "utc",
        "landing": "/",
    }
    first = await operator_client.put("/app/prefs", json={"theme": "dark"})
    assert first.status_code == 200, first.text
    assert first.json()["theme"] == "dark" and first.json()["density"] == "comfortable"
    second = await operator_client.put(
        "/app/prefs", json={"density": "compact", "landing": "/jobs"}
    )
    assert second.json() == {
        "theme": "dark",
        "density": "compact",
        "time_display": "utc",
        "landing": "/jobs",
    }
    assert (await operator_client.get("/app/prefs")).json() == second.json()
    rows = await fetch_all(engine, "SELECT prefs FROM ui.preferences")
    assert len(rows) == 1 and rows[0]["prefs"] == {
        "theme": "dark",
        "density": "compact",
        "landing": "/jobs",
    }
    invalid = await operator_client.put("/app/prefs", json={"theme": "blue"})
    assert invalid.status_code == 422
    assert invalid.json()["error_category"] == "validation_error"
    unknown = await operator_client.put("/app/prefs", json={"colour": "x"})
    assert unknown.status_code == 422
    empty = await operator_client.put("/app/prefs", json={})
    assert empty.status_code == 422
    audit = await fetch_all(
        engine, "SELECT path, status, target FROM ui.audit_log WHERE method = 'PUT'"
    )
    assert audit[0]["path"] == "/app/prefs" and audit[0]["status"] == 200
    assert audit[0]["target"] == {"prefs": ["theme"]}


async def test_b4_routes_need_a_session(client):
    for path in (
        "/app/overview",
        "/app/overview/active-runs",
        "/app/attention",
        "/app/system",
        "/app/system/queue",
        "/app/system/dead-by-category",
        "/app/system/maintenance",
        "/app/prefs",
    ):
        response = await client.get(path)
        assert response.status_code == 401, path
        assert response.json()["error_category"] == "not_authenticated"
