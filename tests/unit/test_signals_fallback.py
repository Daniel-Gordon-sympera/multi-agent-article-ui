"""The fallback's job selection and its 30 s cache, against the stub (no database)."""

from __future__ import annotations

from scout_bff.pipeline_client import PipelineClient
from scout_bff.settings import placeholder_settings
from scout_bff.signals.fallback import (
    MAX_JOBS,
    MergedSignals,
    SignalsCache,
    cached_merge,
    merge_signals,
    select_jobs,
)
from scout_bff.signals.query import SignalsQuery
from tests.pipeline_fixtures import (
    JOB_ANALYSING,
    JOB_COMPLETED,
    JOBS,
    OPERATOR_KEY,
    PIPELINE_URL,
    READER_KEY,
)
from tests.pipeline_stub import PipelineStub


def _client(stub: PipelineStub) -> PipelineClient:
    settings = placeholder_settings(
        pipeline_api_url=PIPELINE_URL,
        pipeline_operator_key=OPERATOR_KEY,
        pipeline_reader_key=READER_KEY,
    )
    return PipelineClient(stub.http_client(), settings)


async def test_select_jobs_returns_the_newest_matching_jobs_first():
    stub = PipelineStub()
    jobs = await select_jobs(_client(stub), None, "operator", {})  # type: ignore[arg-type]
    assert len(jobs) == len(JOBS)
    created = [job["created_at"] for job in jobs]
    assert created == sorted(created, reverse=True)
    florida = await select_jobs(_client(stub), None, "viewer", {"state": "FL"})  # type: ignore[arg-type]
    assert {job["id"] for job in florida} == {JOB_ANALYSING, JOBS[-1]["id"]}
    assert stub.calls.last.request.headers["X-API-Key"] == READER_KEY
    assert stub.calls.last.request.url.params["state"] == "FL"


async def test_select_jobs_is_bounded_to_twenty():
    stub = PipelineStub()
    for index in range(40):
        job = dict(JOBS[0])
        job["id"] = f"0193{index:04d}-0000-4000-8000-000000000000"
        job["created_at"] = f"2026-11-{(index % 28) + 1:02d}T00:00:00+00:00"
        stub.state["jobs"][job["id"]] = job
    jobs = await select_jobs(_client(stub), None, "operator", {})  # type: ignore[arg-type]
    assert len(jobs) == MAX_JOBS
    assert jobs[0]["created_at"] >= jobs[-1]["created_at"]


async def test_merge_marks_truncation_when_a_job_has_more_rows():
    stub = PipelineStub()
    rows = stub.state["signals"][JOB_ANALYSING]
    stub.state["signals"][JOB_ANALYSING] = [
        {**rows[0], "id": 100 + index} for index in range(1001)
    ]
    query = SignalsQuery.from_params({"job_id": JOB_ANALYSING})
    merged = await merge_signals(_client(stub), None, "operator", query)  # type: ignore[arg-type]
    assert merged.scanned_jobs == 1
    assert merged.truncated is True
    assert len(merged.rows) == 1000


async def test_cache_serves_within_the_ttl_and_expires():
    stub = PipelineStub()
    cache = SignalsCache(ttl_seconds=30)
    query = SignalsQuery.from_params({"job_id": JOB_COMPLETED})
    first = await cached_merge(cache, _client(stub), None, "operator", query)  # type: ignore[arg-type]
    calls = len(stub.calls)
    again = await cached_merge(cache, _client(stub), None, "operator", query)  # type: ignore[arg-type]
    assert again is first and len(stub.calls) == calls
    assert cache.get(query.cache_key, now=1e12) is None
    cache.put("k", MergedSignals(rows=[], scanned_jobs=0, truncated=False), now=100.0)
    assert cache.get("k", now=129.0) is not None
    assert cache.get("k", now=130.0) is None
    cache.clear()
    assert cache.get("k") is None
