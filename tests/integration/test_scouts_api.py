"""`/app/scouts*`: CRUD, archive, run fan-out and run history (contract §4.3, §4.5)."""

from __future__ import annotations

from tests.conftest import fetch_all
from tests.pipeline_fixtures import JOB_ANALYSING

BUILDERS = {
    "name": "Orange County builders",
    "kind": "location_industry",
    "county": "Orange",
    "state_code": "FL",
    "location": "Orlando, FL",
    "industries": ["Construction", "Manufacturing", "Wholesale Trade"],
    "source_mode": "finder",
    "settings": {"days": 30, "sites": 5},
}


async def create(client, **overrides):
    response = await client.post("/app/scouts", json={**BUILDERS, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_list_get_patch_archive(operator_client, viewer_client, engine):
    scout = await create(operator_client)
    assert scout["settings"] == {"days": 30, "sites": 5}
    assert scout["archived_at"] is None and scout["created_by"]

    clash = await operator_client.post("/app/scouts", json=BUILDERS)
    assert clash.status_code == 409
    assert clash.json()["error_category"] == "scout_exists"

    listed = await viewer_client.get("/app/scouts")
    assert listed.status_code == 200
    (item,) = listed.json()["items"]
    assert item["id"] == scout["id"]
    assert item["runs_count"] == 0
    assert item["last_run"] is None and item["signals_last_run"] is None

    fetched = await viewer_client.get(f"/app/scouts/{scout['id']}")
    assert fetched.json()["name"] == "Orange County builders"

    patched = await operator_client.patch(
        f"/app/scouts/{scout['id']}",
        json={
            "industries": ["Construction"],
            "settings": {"sites": 3},
            "state_code": "fl",
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["industries"] == ["Construction"]
    assert patched.json()["settings"] == {"sites": 3}
    assert patched.json()["updated_at"] >= scout["updated_at"]

    invalid = await operator_client.patch(
        f"/app/scouts/{scout['id']}", json={"industries": []}
    )
    assert invalid.status_code == 422

    other = await create(operator_client, name="Houston manufacturing")
    rename = await operator_client.patch(
        f"/app/scouts/{other['id']}", json={"name": "Orange County builders"}
    )
    assert rename.status_code == 409

    archived = await operator_client.delete(f"/app/scouts/{scout['id']}")
    assert archived.status_code == 204
    names = [
        s["name"] for s in (await viewer_client.get("/app/scouts")).json()["items"]
    ]
    assert names == ["Houston manufacturing"]
    with_archived = await viewer_client.get("/app/scouts", params={"archived": "true"})
    assert len(with_archived.json()["items"]) == 2
    run_archived = await operator_client.post(f"/app/scouts/{scout['id']}/run")
    assert run_archived.status_code == 409
    assert run_archived.json()["error_category"] == "scout_archived"

    audit = await fetch_all(
        engine,
        "SELECT method, path, status FROM ui.audit_log WHERE path LIKE '/app/scouts%' "
        "ORDER BY id",
    )
    assert [(a["method"], a["status"]) for a in audit] == [
        ("POST", 201),
        ("POST", 409),
        ("PATCH", 200),
        ("PATCH", 422),
        ("POST", 201),
        ("PATCH", 409),
        ("DELETE", 204),
        ("POST", 409),
    ]


async def test_run_fans_out_and_increments_run_numbers(operator_client, pipeline):
    scout = await create(operator_client)
    first = await operator_client.post(f"/app/scouts/{scout['id']}/run")
    assert first.status_code == 201, first.text
    batch = first.json()
    assert batch["scout_id"] == scout["id"] and batch["scout_name"] == scout["name"]
    assert batch["run_number"] == 1
    assert [leg["industry"] for leg in batch["jobs"]] == BUILDERS["industries"]
    assert pipeline.created_jobs[0]["settings"] == {"days": 30, "sites": 5}
    assert pipeline.created_jobs[0]["client_reference"] == (
        f"ui:{batch['id']}:construction"
    )

    second = await operator_client.post(
        f"/app/scouts/{scout['id']}/run", json={"client_reference_suffix": "retry 1"}
    )
    assert second.json()["run_number"] == 2
    assert second.json()["jobs"][0]["client_reference"].endswith(
        ":construction:retry-1"
    )

    listed = (await operator_client.get("/app/scouts")).json()["items"]
    (item,) = listed
    assert item["runs_count"] == 2
    last_run = item["last_run"]
    assert last_run["batch_id"] == second.json()["id"] and last_run["run_number"] == 2
    assert [job["status"] for job in last_run["jobs"]] == ["queued"] * 3
    assert item["signals_last_run"] is None


async def test_last_run_reads_status_and_signals_from_the_api(
    operator_client, pipeline
):
    scout = await create(operator_client)
    batch = (await operator_client.post(f"/app/scouts/{scout['id']}/run")).json()
    job_ids = [leg["job_id"] for leg in batch["jobs"]]
    pipeline.state["jobs"][job_ids[0]]["status"] = "analysing"
    pipeline.state["jobs"][job_ids[0]]["progress"] = {"signals": 24}
    pipeline.state["jobs"][job_ids[1]]["progress"] = {"signals": 3}
    del pipeline.state["jobs"][job_ids[2]]
    from scout_bff.scouts.runs import job_cache

    job_cache.invalidate()
    (item,) = (await operator_client.get("/app/scouts")).json()["items"]
    jobs = item["last_run"]["jobs"]
    assert [(j["status"], j["signals"]) for j in jobs] == [
        ("analysing", 24),
        ("queued", 3),
        (None, None),
    ]
    assert item["signals_last_run"] == 27

    history = await operator_client.get(f"/app/scouts/{scout['id']}/jobs")
    assert history.status_code == 200
    items = history.json()["items"]
    assert [job["id"] for job in items] == list(reversed(job_ids[:2]))
    assert items[1]["status"] == "analysing"


async def test_history_lists_all_batches_newest_first(operator_client):
    scout = await create(operator_client, industries=["Construction"])
    batches = []
    for _ in range(12):
        response = await operator_client.post(f"/app/scouts/{scout['id']}/run")
        assert response.status_code == 201
        batches.append(response.json())
    history = (await operator_client.get(f"/app/scouts/{scout['id']}/jobs")).json()
    expected = [batch["jobs"][0]["job_id"] for batch in reversed(batches)]
    assert [job["id"] for job in history["items"]] == expected
    (item,) = (await operator_client.get("/app/scouts")).json()["items"]
    assert item["runs_count"] == 12 and item["last_run"]["run_number"] == 12
    first = (
        await operator_client.get(
            f"/app/scouts/{scout['id']}/jobs", params={"limit": 5}
        )
    ).json()
    second = (
        await operator_client.get(
            f"/app/scouts/{scout['id']}/jobs",
            params={"limit": 5, "after": first["next_cursor"]},
        )
    ).json()
    assert [row["id"] for row in first["items"] + second["items"]] == expected[:10]
    changed = await operator_client.get(
        f"/app/scouts/{scout['id']}/jobs",
        params={"after": first["next_cursor"], "state": "GA"},
    )
    assert changed.status_code == 400


async def test_seed_scouts_use_the_curated_sources(operator_client, pipeline):
    await operator_client.post(
        "/app/sources",
        json={
            "name": "Range Wire",
            "url": "https://rangewire.com",
            "county": "Jefferson",
            "state_code": "CO",
            "industries": ["Construction"],
        },
    )
    scout = await create(
        operator_client,
        name="Denver metro construction",
        kind="seeds",
        county="Jefferson",
        state_code="CO",
        industries=["Construction"],
        source_mode="seeds",
    )
    run = await operator_client.post(f"/app/scouts/{scout['id']}/run")
    assert run.status_code == 201, run.text
    (leg,) = run.json()["jobs"]
    assert leg["client_reference"] == f"ui:{run.json()['id']}:0"
    body = pipeline.created_jobs[-1]
    assert body["kind"] == "seeds"
    assert body["seeds"] == [{"title": "Range Wire", "url": "https://rangewire.com/"}]


async def test_roles_and_missing_scouts(viewer_client, operator_client):
    denied = await viewer_client.post("/app/scouts", json=BUILDERS)
    assert denied.status_code == 403
    assert denied.json()["error_category"] == "operator_required"
    missing = "00000000-0000-4000-8000-000000000000"
    assert (await viewer_client.get(f"/app/scouts/{missing}")).status_code == 404
    assert (await operator_client.post(f"/app/scouts/{missing}/run")).status_code == 404
    assert (await operator_client.delete(f"/app/scouts/{missing}")).status_code == 404
    assert (await viewer_client.get(f"/app/scouts/{missing}/jobs")).status_code == 404
    bad = await operator_client.post("/app/scouts", json={**BUILDERS, "industries": []})
    assert bad.status_code == 422
    assert bad.json()["error_category"] == "validation_error"
    assert JOB_ANALYSING  # the stub's seeded job stays untouched by these calls
