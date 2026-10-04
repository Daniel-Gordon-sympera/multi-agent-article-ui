"""`GET /app/sources/suggestions`: finder memory + rankings, minus listed and dismissed."""

from __future__ import annotations

import pytest

from scout_bff.sources.suggestions import candidate_cache
from tests.pipeline_fixtures import JOB_ANALYSING, JOB_COMPLETED


@pytest.fixture(autouse=True)
def orange_memory(pipeline):
    """Point the stub's judged-domain memory at the two Orange County location keys."""
    candidate_cache.invalidate()
    rows = pipeline.state["finder_memory"]
    rows[0]["location_key"] = "orange, fl"  # orlandoweekly.com · keep
    rows[1]["location_key"] = "orange county, florida"  # floridadaily.com · keep
    rows[1]["industry_key"] = "manufacturing"
    rows[2]["location_key"] = "orange, fl"  # example-spam.com · reject
    rows.append(
        {
            "location_key": "fulton county, georgia",
            "industry_key": "wholesale trade",
            "domain": "peachreport.com",
            "verdict": "keep",
            "reason": "state coverage",
            "tier": 1,
            "judged_at": "2026-09-30T10:00:00+00:00",
            "job_id": JOB_COMPLETED,
        }
    )
    yield
    candidate_cache.invalidate()


async def test_suggestions_for_a_county(viewer_client, pipeline):
    response = await viewer_client.get(
        "/app/sources/suggestions",
        params={"county": "Orange County", "state": "Florida"},
    )
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    by_domain = {item["domain"]: item for item in items}
    # rankings of the last location_industry jobs of Orange, FL come first …
    assert [item["domain"] for item in items[:3]] == [
        "orlandomagazine.com",
        "orlandosentinel.com",
        "westorlandonews.com",
    ]
    ranked = by_domain["westorlandonews.com"]
    assert ranked["origin"] == "ranking" and ranked["rank"] == 3
    assert ranked["job_id"] == JOB_ANALYSING and ranked["industry"] == "Construction"
    assert ranked["reason"].endswith("ranked 3rd, explored in this job")
    assert (ranked["county"], ranked["state_code"]) == ("Orange", "FL")
    # … then the judged-domain memory with verdict keep, both location spellings
    assert by_domain["orlandoweekly.com"]["origin"] == "finder_memory"
    assert by_domain["orlandoweekly.com"]["tier"] == "2"
    assert by_domain["floridadaily.com"]["industry"] == "Manufacturing"
    assert "example-spam.com" not in by_domain
    assert "peachreport.com" not in by_domain
    memory_calls = [
        dict(call.request.url.params)["location"]
        for call in pipeline.calls
        if call.request.url.path == "/v1/finder/memory"
    ]
    assert sorted(memory_calls) == ["Orange County, Florida", "Orange, FL"]
    assert all(
        dict(call.request.url.params)["verdict"] == "keep"
        for call in pipeline.calls
        if call.request.url.path == "/v1/finder/memory"
    )

    filtered = await viewer_client.get(
        "/app/sources/suggestions",
        params={"county": "Orange", "state": "FL", "industry": "manufacturing"},
    )
    assert [item["domain"] for item in filtered.json()["items"]] == ["floridadaily.com"]
    limited = await viewer_client.get(
        "/app/sources/suggestions",
        params={"county": "Orange", "state": "FL", "limit": 2},
    )
    assert len(limited.json()["items"]) == 2


async def test_listed_and_dismissed_domains_disappear(operator_client):
    params = {"county": "Orange", "state": "FL"}
    before = (
        await operator_client.get("/app/sources/suggestions", params=params)
    ).json()
    domains = {item["domain"] for item in before["items"]}
    assert {"orlandomagazine.com", "floridadaily.com"} <= domains

    added = await operator_client.post(
        "/app/sources",
        json={
            "name": "Orlando Magazine",
            "url": "https://www.orlandomagazine.com",
            "county": "Orange",
            "state_code": "FL",
            "industries": [],
        },
    )
    assert added.status_code == 201
    dismissed = await operator_client.post(
        "/app/sources/dismiss",
        json={"domain": "floridadaily.com", "county": "Orange", "state_code": "FL"},
    )
    assert dismissed.status_code == 204
    after = (
        await operator_client.get("/app/sources/suggestions", params=params)
    ).json()
    remaining = {item["domain"] for item in after["items"]}
    assert "orlandomagazine.com" not in remaining
    assert "floridadaily.com" not in remaining
    assert "orlandosentinel.com" in remaining

    promoted = await operator_client.post(
        "/app/sources/promote",
        json={
            "suggestion": next(
                i for i in after["items"] if i["domain"] == "orlandosentinel.com"
            )
        },
    )
    assert promoted.status_code == 201
    assert promoted.json()["origin"] == "finder"
    assert promoted.json()["finder"]["rank"] == 2
    final = (
        await operator_client.get("/app/sources/suggestions", params=params)
    ).json()
    assert "orlandosentinel.com" not in {item["domain"] for item in final["items"]}


async def test_without_a_location_the_recent_jobs_decide(viewer_client, pipeline):
    response = await viewer_client.get("/app/sources/suggestions")
    assert response.status_code == 200
    items = response.json()["items"]
    pairs = {(item["county"], item["state_code"]) for item in items}
    assert ("Orange", "FL") in pairs and ("Fulton", "GA") in pairs
    assert any(item["domain"] == "peachreport.com" for item in items)
    locations = {
        dict(call.request.url.params)["location"]
        for call in pipeline.calls
        if call.request.url.path == "/v1/finder/memory"
    }
    assert "Fulton County, Georgia" in locations and "Orange, FL" in locations
    assert not any(location.startswith("Maricopa") for location in locations)


async def test_pipeline_outage_is_a_503(viewer_client, pipeline):
    pipeline.down = True
    response = await viewer_client.get(
        "/app/sources/suggestions", params={"county": "Orange", "state": "FL"}
    )
    assert response.status_code == 503
    assert response.json()["error_category"] == "pipeline_api_unavailable"
