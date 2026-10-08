"""Dashboard counts must consume all pages and must not hide upstream failures."""

import httpx
import pytest

from scout_bff.overview.pipeline_reads import (
    fetch_job_details,
    fetch_job_resources,
    recent_daily_stats,
)
from scout_bff.pipeline_client import PipelineClient, PipelineError
from scout_bff.settings import placeholder_settings
from tests.pipeline_fixtures import JOB_COMPLETED, OPERATOR_KEY, READER_KEY


def client(handler):
    return PipelineClient(
        httpx.AsyncClient(
            base_url="http://pipeline.test", transport=httpx.MockTransport(handler)
        ),
        placeholder_settings(
            pipeline_operator_key=OPERATOR_KEY,
            pipeline_reader_key=READER_KEY,
        ),
    )


async def test_resources_and_daily_counts_include_later_pages():
    calls = []

    def page(request):
        calls.append(str(request.url))
        if request.url.params.get("after") == "last-page":
            return httpx.Response(
                200, json={"items": [{"id": 1001}], "next_cursor": None}
            )
        return httpx.Response(
            200,
            json={
                "items": [{"id": number} for number in range(1, 1001)],
                "next_cursor": "last-page",
            },
        )

    pipeline = client(page)
    resources = await fetch_job_resources(
        pipeline, [JOB_COMPLETED], "site-runs", role="viewer"
    )
    assert len(resources[JOB_COMPLETED]) == 1001
    assert len(await recent_daily_stats(pipeline, role="viewer", days=30)) == 1001
    assert len(calls) == 4


@pytest.mark.parametrize("status", [401, 403, 503])
async def test_detail_failures_are_not_reported_as_missing_jobs(status):
    def unavailable(request):
        return httpx.Response(
            status,
            json={
                "error_category": "upstream_failure",
                "detail": "Unavailable",
            },
        )

    with pytest.raises(PipelineError) as error:
        await fetch_job_details(client(unavailable), [JOB_COMPLETED], role="viewer")
    assert error.value.status == status
