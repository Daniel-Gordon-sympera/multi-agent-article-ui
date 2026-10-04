"""`POST /app/batches` fan-out against the stub pipeline API (contract §4.5)."""

from __future__ import annotations

import json

import httpx

from tests.conftest import fetch_all
from tests.pipeline_support import problem

LOCATION_BATCH = {
    "kind": "location_industry",
    "county": "Orange",
    "state_code": "FL",
    "location": "Orlando, FL",
    "industries": ["Construction", "Manufacturing", "Wholesale Trade"],
    "settings": {"sites": 5},
}


def override_create_job(pipeline, handler):
    """Replace the stub's POST /v1/jobs handler in place (same route position)."""
    original = pipeline._create_job

    def wrapper(request: httpx.Request) -> httpx.Response:
        return handler(request, original)

    pipeline.router.route(method="POST", path="/v1/jobs").mock(side_effect=wrapper)


async def test_fan_out_creates_one_job_per_industry(operator_client, pipeline, engine):
    response = await operator_client.post("/app/batches", json=LOCATION_BATCH)
    assert response.status_code == 201, response.text
    batch = response.json()
    assert batch["scout_id"] is None and batch["run_number"] is None
    assert response.headers["Location"] == f"/app/batches/{batch['id']}"
    legs = batch["jobs"]
    assert [leg["position"] for leg in legs] == [1, 2, 3]
    assert [leg["industry"] for leg in legs] == LOCATION_BATCH["industries"]
    assert legs[2]["client_reference"] == f"ui:{batch['id']}:wholesale-trade"
    assert all(leg["job_id"] and leg["status"] == "queued" for leg in legs)
    assert all(leg["error"] is None for leg in legs)

    bodies = pipeline.created_jobs
    assert [body["industry"] for body in bodies] == LOCATION_BATCH["industries"]
    assert bodies[0]["location"] == "Orlando, FL"
    assert bodies[0]["settings"] == {"sites": 5}
    assert bodies[0]["county"] == "Orange" and bodies[0]["state"] == "FL"

    rows = await fetch_all(
        engine,
        "SELECT position, industry, job_id::text AS job_id, client_reference, error "
        "FROM ui.batch_jobs ORDER BY position",
    )
    assert [row["job_id"] for row in rows] == [leg["job_id"] for leg in legs]
    batches = await fetch_all(engine, "SELECT requested FROM ui.batches")
    assert batches[0]["requested"]["industries"] == LOCATION_BATCH["industries"]
    audit = await fetch_all(
        engine,
        "SELECT method, path, status, target FROM ui.audit_log "
        "WHERE path LIKE '/app/batches%' ORDER BY id",
    )
    assert [(a["method"], a["path"], a["status"]) for a in audit] == [
        ("POST", "/app/batches", 201)
    ]
    assert audit[0]["target"]["batch_id"] == batch["id"]
    assert audit[0]["target"]["job_ids"] == [leg["job_id"] for leg in legs]


async def test_conflicting_and_rejected_legs_are_recorded(operator_client, pipeline):
    existing_job_id = next(iter(pipeline.state["jobs"]))

    def handler(request: httpx.Request, original):
        body = json.loads(request.content)
        if body["industry"] == "Manufacturing":
            return problem(
                request,
                409,
                "client_reference_exists",
                "This client_reference already identifies a job.",
                job_id=existing_job_id,
                job_status="completed",
            )
        if body["industry"] == "Wholesale Trade":
            return problem(
                request, 422, "validation_error", "industry is not in the catalogue"
            )
        return original(request)

    override_create_job(pipeline, handler)
    response = await operator_client.post("/app/batches", json=LOCATION_BATCH)
    assert response.status_code == 201, response.text
    first, second, third = response.json()["jobs"]
    assert first["job_id"] and first["status"] == "queued" and first["error"] is None
    assert second["job_id"] == existing_job_id
    assert second["status"] == "completed" and second["error"] is None
    assert third["job_id"] is None and third["status"] is None
    assert third["error"] == "industry is not in the catalogue"


async def test_unreachable_api_is_a_502_and_leaves_nothing_behind(
    operator_client, pipeline, engine
):
    pipeline.down = True
    response = await operator_client.post(
        "/app/batches", json={**LOCATION_BATCH, "save_as_scout": {"name": "Ghost"}}
    )
    assert response.status_code == 502
    assert response.json()["error_category"] == "pipeline_api_unavailable"
    assert await fetch_all(engine, "SELECT id FROM ui.batches") == []
    assert await fetch_all(engine, "SELECT id FROM ui.scouts") == []


async def test_url_kind_is_a_single_leg(operator_client, pipeline):
    response = await operator_client.post(
        "/app/batches",
        json={
            "kind": "url",
            "county": "Orange",
            "state_code": "Florida",
            "url": "orlandomagazine.com",
            "industries": [],
            "settings": {},
        },
    )
    assert response.status_code == 201, response.text
    (leg,) = response.json()["jobs"]
    assert leg["client_reference"].endswith(":0") and leg["industry"] is None
    body = pipeline.created_jobs[0]
    assert body["url"] == "https://orlandomagazine.com/" and body["state"] == "FL"
    assert "settings" not in body and "industry" not in body


async def test_seed_batches_compose_seeds_from_active_sources(
    operator_client, pipeline
):
    async def add(name, url, county="Orange", state="FL", industries=None):
        response = await operator_client.post(
            "/app/sources",
            json={
                "name": name,
                "url": url,
                "county": county,
                "state_code": state,
                "industries": industries or [],
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    await add(
        "Orlando Magazine", "https://orlandomagazine.com", industries=["Construction"]
    )
    await add("Orlando Sentinel", "https://orlandosentinel.com")
    retail = await add(
        "Shop Talk", "https://shoptalk.example", industries=["Retail Trade"]
    )
    removed = await add("Old News", "https://oldnews.example")
    await operator_client.delete(f"/app/sources/{removed['id']}")
    await add("Range Wire", "https://rangewire.com", county="Jefferson", state="CO")

    response = await operator_client.post(
        "/app/batches",
        json={
            "kind": "seeds",
            "county": "Orange County",
            "state_code": "FL",
            "industries": ["Construction"],
            "settings": {},
        },
    )
    assert response.status_code == 201, response.text
    seeds = pipeline.created_jobs[-1]["seeds"]
    assert seeds == [
        {"title": "Orlando Magazine", "url": "https://orlandomagazine.com/"},
        {"title": "Orlando Sentinel", "url": "https://orlandosentinel.com/"},
    ]
    assert retail["domain"] not in {seed["url"] for seed in seeds}

    everything = await operator_client.post(
        "/app/batches",
        json={
            "kind": "seeds",
            "county": "Orange",
            "state_code": "FL",
            "industries": [],
        },
    )
    assert len(pipeline.created_jobs[-1]["seeds"]) == 3
    assert everything.status_code == 201

    none = await operator_client.post(
        "/app/batches",
        json={"kind": "seeds", "county": "Cook", "state_code": "IL", "industries": []},
    )
    assert none.status_code == 422
    assert none.json()["error_category"] == "no_active_sources"


async def test_save_as_scout_and_run_numbers(operator_client, engine):
    first = await operator_client.post(
        "/app/batches", json={**LOCATION_BATCH, "save_as_scout": {"name": "Builders"}}
    )
    assert first.status_code == 201, first.text
    batch = first.json()
    assert batch["scout_name"] == "Builders" and batch["run_number"] == 1
    scout = await operator_client.get(f"/app/scouts/{batch['scout_id']}")
    assert scout.status_code == 200
    assert scout.json()["industries"] == LOCATION_BATCH["industries"]
    assert scout.json()["settings"] == {"sites": 5}

    second = await operator_client.post(
        "/app/batches", json={**LOCATION_BATCH, "scout_id": batch["scout_id"]}
    )
    assert second.json()["run_number"] == 2
    duplicate = await operator_client.post(
        "/app/batches", json={**LOCATION_BATCH, "save_as_scout": {"name": "builders"}}
    )
    assert duplicate.status_code == 201  # names are case-sensitive in the schema
    clash = await operator_client.post(
        "/app/batches", json={**LOCATION_BATCH, "save_as_scout": {"name": "Builders"}}
    )
    assert clash.status_code == 409
    assert clash.json()["error_category"] == "scout_exists"
    assert len(await fetch_all(engine, "SELECT id FROM ui.batches")) == 3


async def test_lookup_and_detail_refresh_statuses(operator_client, pipeline):
    created = (await operator_client.post("/app/batches", json=LOCATION_BATCH)).json()
    job_ids = [leg["job_id"] for leg in created["jobs"]]
    lookup = await operator_client.get(
        "/app/batches",
        params={"job_ids": ",".join([*job_ids, "not-a-uuid", job_ids[0]])},
    )
    assert lookup.status_code == 200
    memberships = lookup.json()["batches"]
    assert set(memberships) == set(job_ids)
    assert memberships[job_ids[1]] == {
        "batch_id": created["id"],
        "position": 2,
        "size": 3,
        "scout_id": None,
        "scout_name": None,
        "run_number": None,
    }
    assert (await operator_client.get("/app/batches")).json() == {"batches": {}}

    pipeline.state["jobs"][job_ids[0]]["status"] = "analysing"
    del pipeline.state["jobs"][job_ids[2]]
    detail = await operator_client.get(f"/app/batches/{created['id']}")
    assert detail.status_code == 200
    statuses = [leg["status"] for leg in detail.json()["jobs"]]
    assert statuses == ["analysing", "queued", None]
    missing = await operator_client.get(
        "/app/batches/00000000-0000-4000-8000-000000000000"
    )
    assert missing.status_code == 404


async def test_viewers_cannot_fan_out_but_can_look_batches_up(viewer_client):
    denied = await viewer_client.post("/app/batches", json=LOCATION_BATCH)
    assert denied.status_code == 403
    assert denied.json()["error_category"] == "operator_required"
    assert (await viewer_client.get("/app/batches?job_ids=")).status_code == 200


async def test_validation_errors_are_problems(operator_client):
    response = await operator_client.post(
        "/app/batches",
        json={"kind": "location_industry", "county": "Orange", "state_code": "ZZ"},
    )
    assert response.status_code == 422
    assert response.json()["error_category"] == "validation_error"
    response = await operator_client.post(
        "/app/batches",
        json={"kind": "url", "county": "Orange", "state_code": "FL", "industries": []},
    )
    assert response.status_code == 422
