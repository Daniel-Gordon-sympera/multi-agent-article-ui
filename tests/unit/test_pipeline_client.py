"""PipelineClient against the stub: filters, pagination, problems, retries."""

import pytest

from scout_bff.pipeline_client import (
    PipelineClient,
    PipelineError,
    PipelineUnavailable,
    clean_params,
)
from scout_bff.settings import placeholder_settings
from tests.pipeline_fixtures import (
    DEAD_TASK_ID,
    JOB_ANALYSING,
    OPERATOR_KEY,
    PIPELINE_URL,
    READER_KEY,
    RUNNING_TASK_ID,
)
from tests.pipeline_stub import PipelineStub


@pytest.fixture
def stub() -> PipelineStub:
    return PipelineStub()


@pytest.fixture
def pipeline(stub: PipelineStub) -> PipelineClient:
    settings = placeholder_settings(
        pipeline_api_url=PIPELINE_URL,
        pipeline_operator_key=OPERATOR_KEY,
        pipeline_reader_key=READER_KEY,
    )
    return PipelineClient(stub.http_client(), settings)


def test_clean_params_drops_none_and_lowercases_booleans():
    assert clean_params({"a": None, "chosen": True, "limit": 5}) == {
        "chosen": "true",
        "limit": 5,
    }


async def test_list_jobs_with_filters_and_keyset_pagination(pipeline, stub):
    page = await pipeline.list_jobs(state="FL", limit=1)
    assert len(page["items"]) == 1 and page["next_cursor"]
    second = await pipeline.list_jobs(state="FL", limit=1, after=page["next_cursor"])
    assert len(second["items"]) == 1 and second["next_cursor"] is None
    assert {page["items"][0]["id"], second["items"][0]["id"]} == {
        JOB_ANALYSING,
        "0192f1c3-7e0a-4c1b-9d33-5a1e8b2f0c42",
    }
    assert stub.calls.last.request.headers["X-API-Key"] == OPERATOR_KEY
    everything = [item async for item in pipeline.iter_items("/v1/jobs", limit=2)]
    assert len(everything) == 6


async def test_unknown_filter_is_a_pipeline_error(pipeline):
    with pytest.raises(PipelineError) as error:
        await pipeline.list_jobs(unknown="value")
    assert error.value.status == 422
    assert error.value.category == "unknown_filter"


async def test_get_job_and_resources(pipeline):
    job = await pipeline.get_job(JOB_ANALYSING)
    assert job["progress"]["tasks_dead"] == 1
    tasks = await pipeline.list_job_resource(JOB_ANALYSING, "tasks", status="dead")
    assert [task["id"] for task in tasks["items"]] == [DEAD_TASK_ID]
    signals = await pipeline.list_job_signals(JOB_ANALYSING, org_kind="gov")
    assert [row["company"] for row in signals["items"]] == ["City of Winter Garden"]
    ranking = await pipeline.ranking(JOB_ANALYSING, chosen=True)
    assert len(ranking["items"]) == 3
    assert (await pipeline.workers())["items"][0]["instance_id"] == "analysis-1"
    assert len((await pipeline.daily_stats(created_after="2026-10-02"))["items"]) == 2
    memory = await pipeline.finder_memory(verdict="accept")
    assert {row["domain"] for row in memory["items"]} == {
        "floridadaily.com",
        "orlandoweekly.com",
    }


async def test_viewer_role_uses_reader_key(pipeline, stub):
    await pipeline.list_jobs(role="viewer")
    assert stub.calls.last.request.headers["X-API-Key"] == READER_KEY


async def test_create_job_then_conflict_on_reused_reference(pipeline, stub):
    body = {
        "kind": "location_industry",
        "location": "Orlando, FL",
        "industry": "Construction",
        "county": "Orange",
        "state": "FL",
        "client_reference": "ui:batch:construction",
    }
    created = await pipeline.create_job(body)
    assert created["status"] == "queued" and created["job_id"]
    with pytest.raises(PipelineError) as error:
        await pipeline.create_job(body)
    assert error.value.status == 409
    assert error.value.category == "client_reference_exists"
    assert error.value.extra["job_id"] == created["job_id"]
    with pytest.raises(PipelineError) as invalid:
        await pipeline.create_job({"kind": "url"})
    assert invalid.value.status == 422
    assert invalid.value.extra["errors"]


async def test_retry_and_cancel(pipeline):
    result = await pipeline.retry_task(DEAD_TASK_ID)
    assert result == {"task_id": DEAD_TASK_ID, "status": "queued", "attempts": 0}
    with pytest.raises(PipelineError) as error:
        await pipeline.retry_task(RUNNING_TASK_ID)
    assert error.value.category == "task_not_dead"
    assert (await pipeline.cancel_job(JOB_ANALYSING))["status"] == "cancelling"


async def test_unavailable_and_retries(pipeline, stub):
    stub.down = True
    with pytest.raises(PipelineUnavailable) as error:
        await pipeline.readyz()
    assert error.value.status == 503
    assert error.value.category == "pipeline_api_unavailable"
    stub.down = False
    stub.fail_connects = 2
    assert (await pipeline.readyz())["status"] == "ready"
    stub.fail_connects = 3
    with pytest.raises(PipelineUnavailable):
        await pipeline.readyz()
    stub.fail_connects = 1
    with pytest.raises(PipelineUnavailable):
        await pipeline.retry_task(DEAD_TASK_ID)  # POST never retries


async def test_readyz_body_for_not_ready(pipeline, stub):
    stub.ready = False
    body = await pipeline.readyz()
    assert body["status"] == "not_ready"
    assert body["checks"]["migrations"] is False
