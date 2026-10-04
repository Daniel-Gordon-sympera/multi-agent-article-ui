"""/app/estimate: the recent-jobs fallback, the capability path and the cache."""

import copy

from tests.pipeline_fixtures import JOB_COMPLETED, OPERATOR_KEY, READER_KEY

ESTIMATE = "/app/estimate"


async def test_estimate_from_the_recent_completed_jobs(operator_client, pipeline):
    response = await operator_client.get(
        ESTIMATE, params={"kind": "location_industry", "sites": 5}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "median_cost_usd": 1.21,
        "p90_cost_usd": 1.21,
        "samples": 1,
        "basis": "recent_jobs",
    }
    paths = [call.request.url.path for call in pipeline.calls]
    assert f"/v1/jobs/{JOB_COMPLETED}" in paths
    assert pipeline.calls.last.request.headers["X-API-Key"] == OPERATOR_KEY
    # Only completed jobs were listed.
    listing = next(c for c in pipeline.calls if c.request.url.path == "/v1/jobs")
    assert listing.request.url.params["status"] == "completed"
    assert "industry" not in listing.request.url.params


async def test_estimate_filters_by_industry_in_the_bff(viewer_client, pipeline):
    match = await viewer_client.get(
        ESTIMATE, params={"kind": "location_industry", "industry": "wholesale trade"}
    )
    assert match.json()["samples"] == 1
    assert pipeline.calls.last.request.headers["X-API-Key"] == READER_KEY
    none = await viewer_client.get(
        ESTIMATE, params={"kind": "location_industry", "industry": "Mining"}
    )
    assert none.status_code == 200 and none.json() == {"samples": 0}
    seeds = await viewer_client.get(ESTIMATE, params={"kind": "seeds"})
    assert seeds.json() == {"samples": 0}


async def test_estimate_is_cached_for_a_minute(operator_client, pipeline):
    await operator_client.get(ESTIMATE, params={"kind": "location_industry"})
    calls = len(pipeline.calls)
    again = await operator_client.get(ESTIMATE, params={"kind": "location_industry"})
    assert again.json()["samples"] == 1
    assert len(pipeline.calls) == calls


async def test_estimate_proxies_the_api_when_capable(operator_client, pipeline, app):
    document = copy.deepcopy(pipeline.openapi)
    document["paths"]["/v1/stats/cost-estimate"] = {"get": {"responses": {"200": {}}}}
    pipeline.openapi = document
    await app.state.capabilities.probe()
    response = await operator_client.get(
        ESTIMATE, params={"kind": "location_industry", "sites": 5, "industry": "Retail"}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "median_cost_usd": 2.95,
        "p90_cost_usd": 3.4,
        "samples": 10,
        "basis": "api",
    }
    assert pipeline.state["cost_estimate_calls"] == [
        {"kind": "location_industry", "sites": "5", "industry": "Retail"}
    ]


async def test_estimate_validates_its_query(operator_client, client):
    bad = await operator_client.get(ESTIMATE, params={"kind": "bogus"})
    assert bad.status_code == 422
    anonymous = await client.get(ESTIMATE)
    assert anonymous.status_code == 401
