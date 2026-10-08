"""/app/jobs/progress and /app/jobs/{id}/retry-dead against the stub pipeline API."""

import copy

from tests.pipeline_fixtures import (
    DEAD_TASK_ID,
    JOB_ANALYSING,
    JOB_COMPLETED,
    JOB_QUEUED,
    OPERATOR_KEY,
    READER_KEY,
    RUNNING_TASK_ID,
)

PROGRESS = "/app/jobs/progress"


async def test_progress_snapshots_per_job(operator_client, pipeline):
    response = await operator_client.get(
        PROGRESS, params={"job_ids": f"{JOB_ANALYSING},{JOB_COMPLETED},{JOB_QUEUED}"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {JOB_ANALYSING, JOB_COMPLETED, JOB_QUEUED}
    analysing = body[JOB_ANALYSING]
    assert analysing["status"] == "analysing"
    assert analysing["progress"]["articles"] == 40
    assert analysing["cost_usd"] == 1.21
    assert (analysing["sites_done"], analysing["sites_total"]) == (4, 5)
    assert analysing["duration_seconds"] > 0
    assert body[JOB_COMPLETED]["sites_done"] == 2
    queued = body[JOB_QUEUED]
    assert queued["sites_total"] == 0 and queued["duration_seconds"] is None
    assert pipeline.calls.last.request.headers["X-API-Key"] == OPERATOR_KEY


async def test_progress_uses_reader_key_for_viewers_and_caches(viewer_client, pipeline):
    first = await viewer_client.get(PROGRESS, params={"job_ids": JOB_ANALYSING})
    assert first.status_code == 200
    assert pipeline.calls.last.request.headers["X-API-Key"] == READER_KEY
    calls_before = len(pipeline.calls)
    pipeline.state["jobs"][JOB_ANALYSING]["status"] = "completed"
    second = await viewer_client.get(PROGRESS, params={"job_ids": JOB_ANALYSING})
    assert second.json()[JOB_ANALYSING]["status"] == "analysing"  # served from cache
    assert len(pipeline.calls) == calls_before


async def test_progress_skips_unknown_ids_and_rejects_too_many(operator_client):
    response = await operator_client.get(
        PROGRESS, params={"job_ids": f"{JOB_ANALYSING},does-not-exist"}
    )
    assert response.status_code == 200
    assert set(response.json()) == {JOB_ANALYSING}
    empty = await operator_client.get(PROGRESS)
    assert empty.status_code == 200 and empty.json() == {}
    too_many = await operator_client.get(
        PROGRESS, params={"job_ids": ",".join(f"j{n}" for n in range(51))}
    )
    assert too_many.status_code == 422
    assert too_many.json()["error_category"] == "too_many_job_ids"


async def test_progress_requires_a_session(client):
    response = await client.get(PROGRESS, params={"job_ids": JOB_ANALYSING})
    assert response.status_code == 401


async def test_retry_dead_proxies_when_the_api_has_the_route(
    operator_client, pipeline, app
):
    document = copy.deepcopy(pipeline.openapi)
    document["paths"]["/v1/jobs/{job_id}/retry-dead"] = {
        "post": {"responses": {"202": {}}}
    }
    pipeline.openapi = document
    await app.state.capabilities.probe()
    assert app.state.capabilities.capabilities["retry_dead"] is True
    response = await operator_client.post(f"/app/jobs/{JOB_ANALYSING}/retry-dead")
    assert response.status_code == 200, response.text
    assert response.json()["task_ids"] == [DEAD_TASK_ID]
    assert pipeline.state["retry_dead_calls"] == [JOB_ANALYSING]
    paths = [call.request.url.path for call in pipeline.calls]
    assert f"/v1/tasks/{DEAD_TASK_ID}/retry" not in paths


async def test_retry_dead_needs_the_operator_role_and_an_existing_job(
    viewer_client, operator_client, pipeline
):
    forbidden = await viewer_client.post(f"/app/jobs/{JOB_ANALYSING}/retry-dead")
    assert forbidden.status_code == 403
    assert forbidden.json()["error_category"] == "operator_required"
    missing = await operator_client.post("/app/jobs/nope/retry-dead")
    assert missing.status_code == 404
    assert pipeline.state["tasks"][RUNNING_TASK_ID]["status"] == "running"
