"""Cost estimates preserve backend sample and completeness semantics."""

from tests.pipeline_fixtures import READER_KEY
from tests.pipeline_stub_jobs import COST_ESTIMATE


async def test_estimate_forwards_all_filters_and_preserves_zero_cost_fields(
    viewer_client, pipeline
):
    response = await viewer_client.get(
        "/app/estimate",
        params={
            "kind": "seeds",
            "sites": 3,
            "days": 14,
            "industry": "Retail",
        },
    )
    assert response.status_code == 200
    assert response.json() == COST_ESTIMATE
    sent = pipeline.calls.last.request
    assert sent.headers["X-API-Key"] == READER_KEY
    assert dict(sent.url.params) == {
        "kind": "seeds",
        "sites": "3",
        "days": "14",
        "industry": "Retail",
    }


async def test_estimate_is_cached_for_a_minute(operator_client, pipeline):
    first = await operator_client.get("/app/estimate")
    calls = len(pipeline.calls)
    assert (await operator_client.get("/app/estimate")).json() == first.json()
    assert len(pipeline.calls) == calls


async def test_estimate_validates_its_query(operator_client, client):
    assert (await operator_client.get("/app/estimate?kind=bogus")).status_code == 422
    assert (await client.get("/app/estimate")).status_code == 401
