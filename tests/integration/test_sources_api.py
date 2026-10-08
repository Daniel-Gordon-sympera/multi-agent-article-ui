"""`/app/sources*`: CRUD, soft remove/restore, CSV import, promote/dismiss, stats."""

from __future__ import annotations

import httpx
import pytest

from tests.conftest import fetch_all

ORLANDO = {
    "name": "Orlando Magazine",
    "url": "https://www.orlandomagazine.com/",
    "county": "Orange County",
    "state_code": "Florida",
    "industries": ["Construction", "Manufacturing"],
}


async def add(client, **overrides):
    response = await client.post("/app/sources", json={**ORLANDO, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_normalises_and_rejects_duplicates(operator_client, engine):
    source = await add(operator_client)
    assert source["domain"] == "orlandomagazine.com"
    assert source["url"] == "https://www.orlandomagazine.com/"
    assert (source["county"], source["state_code"]) == ("Orange", "FL")
    assert source["origin"] == "manual" and source["finder"] is None
    assert source["status"] == "active" and source["precision"] is None

    duplicate = await operator_client.post(
        "/app/sources", json={**ORLANDO, "url": "http://orlandomagazine.com/news"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error_category"] == "source_exists"
    other_county = await add(operator_client, county="Osceola")
    assert other_county["county"] == "Osceola"

    bad_url = await operator_client.post(
        "/app/sources", json={**ORLANDO, "url": "ftp://x.com", "county": "Lake"}
    )
    assert bad_url.status_code == 422
    assert bad_url.json()["error_category"] == "invalid_url"
    bad_state = await operator_client.post(
        "/app/sources", json={**ORLANDO, "state_code": "Narnia"}
    )
    assert bad_state.status_code == 422
    assert bad_state.json()["error_category"] == "validation_error"
    audit = await fetch_all(
        engine,
        "SELECT status, target FROM ui.audit_log WHERE path = '/app/sources' ORDER BY id",
    )
    assert [row["status"] for row in audit] == [201, 409, 201, 422, 422]
    assert audit[0]["target"] == {"source_id": source["id"], "domain": source["domain"]}


async def test_list_filters_and_stats(operator_client, viewer_client):
    await add(operator_client)
    await add(operator_client, name="Range Wire", url="rangewire.com", county="Jefferson",
              state_code="CO", industries=["Construction"])  # fmt: skip
    removed = await add(
        operator_client,
        name="Prairie Post",
        url="https://prairiepost.com",
        county="Cook",
        state_code="IL",
        industries=["Utilities"],
    )
    assert (
        await operator_client.delete(f"/app/sources/{removed['id']}")
    ).status_code == 204

    everything = await viewer_client.get("/app/sources", params={"status": "all"})
    assert everything.status_code == 200
    body = everything.json()
    assert len(body["items"]) == 3
    assert body["stats"] == {
        "active": 2,
        "promoted": 0,
        "removed": 1,
        "counties": 2,
        "median_precision": None,
    }
    default = (await viewer_client.get("/app/sources")).json()
    assert [s["name"] for s in default["items"]] == ["Range Wire", "Orlando Magazine"]
    removed_only = (await viewer_client.get("/app/sources?status=removed")).json()
    assert [s["status"] for s in removed_only["items"]] == ["removed"]
    assert removed_only["items"][0]["removed_at"]

    by_state = (await viewer_client.get("/app/sources?state=Colorado")).json()
    assert [s["domain"] for s in by_state["items"]] == ["rangewire.com"]
    by_county = (await viewer_client.get("/app/sources?county=orange%20county")).json()
    assert [s["domain"] for s in by_county["items"]] == ["orlandomagazine.com"]
    by_industry = (
        await viewer_client.get("/app/sources?industry=manufacturing")
    ).json()
    assert [s["domain"] for s in by_industry["items"]] == ["orlandomagazine.com"]
    by_q = (await viewer_client.get("/app/sources?q=range")).json()
    assert [s["name"] for s in by_q["items"]] == ["Range Wire"]
    assert (await viewer_client.get("/app/sources?origin=finder")).json()["items"] == []
    assert (await viewer_client.get("/app/sources?status=bogus")).status_code == 422
    assert (await viewer_client.get("/app/sources?state=Narnia")).status_code == 422


async def test_patch_remove_restore(operator_client, engine):
    source = await add(operator_client)
    patched = await operator_client.patch(
        f"/app/sources/{source['id']}",
        json={
            "name": "Orlando Mag",
            "url": "https://orlando-mag.com/x",
            "industries": [],
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "Orlando Mag"
    assert patched.json()["domain"] == "orlando-mag.com"
    assert patched.json()["industries"] == []

    other = await add(
        operator_client, name="Sentinel", url="https://orlandosentinel.com"
    )
    clash = await operator_client.patch(
        f"/app/sources/{other['id']}", json={"url": "https://orlando-mag.com"}
    )
    assert clash.status_code == 409

    removed = await operator_client.delete(f"/app/sources/{source['id']}")
    assert removed.status_code == 204
    rows = await fetch_all(
        engine,
        "SELECT status, removed_at FROM ui.sources WHERE id = CAST(:id AS uuid)",
        id=source["id"],
    )
    assert rows[0]["status"] == "removed" and rows[0]["removed_at"] is not None
    restored = await operator_client.post(f"/app/sources/{source['id']}/restore")
    assert restored.status_code == 200
    assert (
        restored.json()["status"] == "active" and restored.json()["removed_at"] is None
    )
    missing = "00000000-0000-4000-8000-000000000000"
    assert (await operator_client.delete(f"/app/sources/{missing}")).status_code == 404
    assert (
        await operator_client.patch(f"/app/sources/{missing}", json={})
    ).status_code == 404


async def test_csv_import(operator_client, engine):
    await add(operator_client)
    csv_text = (
        "name,url,county,state,industries\n"
        "Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction\n"
        "GrowthSpotter,https://growthspotter.com,Orange County,Florida,"
        "Construction;Real Estate\n"
        "Bad,notaurl,Orange,FL,\n"
        "Range Wire,https://rangewire.com,Jefferson,CO,Construction\n"
        "Range Wire again,https://www.rangewire.com,Jefferson,CO,\n"
    )
    response = await operator_client.post(
        "/app/sources/import",
        files={"file": ("sources.csv", csv_text.encode(), "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "imported": 2,
        "skipped": [
            {"row": 2, "reason": "already listed for this county and state"},
            {"row": 4, "reason": "invalid url: The URL has no valid host name."},
            {"row": 6, "reason": "duplicate of an earlier row in the file"},
        ],
    }
    rows = await fetch_all(
        engine, "SELECT domain, origin, industries FROM ui.sources ORDER BY domain"
    )
    assert [(r["domain"], r["origin"]) for r in rows] == [
        ("growthspotter.com", "csv"),
        ("orlandomagazine.com", "manual"),
        ("rangewire.com", "csv"),
    ]
    assert rows[0]["industries"] == ["Construction", "Real Estate"]

    too_large = await operator_client.post(
        "/app/sources/import",
        files={"file": ("big.csv", b"x" * (1_048_576 + 1), "text/csv")},
    )
    assert too_large.status_code == 413
    no_header = await operator_client.post(
        "/app/sources/import", files={"file": ("x.csv", b"name,url\n", "text/csv")}
    )
    assert no_header.status_code == 422
    assert no_header.json()["error_category"] == "invalid_csv"
    audit = await fetch_all(
        engine,
        "SELECT status, target FROM ui.audit_log WHERE path = '/app/sources/import' "
        "ORDER BY id",
    )
    assert audit[0]["status"] == 200
    assert audit[0]["target"] == {
        "imported": 2,
        "skipped": 3,
        "filename": "sources.csv",
    }


async def test_promote_and_dismiss(operator_client, viewer_client, engine):
    suggestion = {
        "domain": "orlandoweekly.com",
        "name": "Orlando Weekly",
        "url": "https://orlandoweekly.com",
        "tier": 2,
        "verdict": "keep",
        "reason": "Kept by the finder (coverage: local); ranked 4th",
        "judged_at": "2026-10-04T11:02:00+00:00",
        "rank": 4,
        "job_id": "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41",
        "county": "Orange",
        "state_code": "FL",
        "industry": "Construction",
        "origin": "ranking",
    }
    promoted = await operator_client.post(
        "/app/sources/promote", json={"suggestion": suggestion}
    )
    assert promoted.status_code == 201, promoted.text
    source = promoted.json()
    assert source["origin"] == "finder" and source["name"] == "Orlando Weekly"
    assert source["industries"] == ["Construction"]
    assert source["finder"] == {
        "tier": "2",
        "verdict": "keep",
        "reason": suggestion["reason"],
        "judged_at": suggestion["judged_at"],
        "rank": 4,
        "job_id": suggestion["job_id"],
        "origin": "ranking",
    }
    again = await operator_client.post(
        "/app/sources/promote", json={"suggestion": suggestion}
    )
    assert again.status_code == 409
    renamed = await operator_client.post(
        "/app/sources/promote",
        json={
            "suggestion": {
                **suggestion,
                "domain": "floridadaily.com",
                "url": "floridadaily.com",
            },
            "name": "Florida Daily",
            "industries": ["Manufacturing", "Construction"],
        },
    )
    assert renamed.status_code == 201
    assert renamed.json()["industries"] == ["Manufacturing", "Construction"]
    stats = (await viewer_client.get("/app/sources")).json()["stats"]
    assert stats["promoted"] == 2 and stats["active"] == 2

    dismissed = await operator_client.post(
        "/app/sources/dismiss",
        json={
            "domain": "https://www.denverite.com/",
            "county": "Jefferson County",
            "state_code": "Colorado",
        },  # fmt: skip
    )
    assert dismissed.status_code == 204
    rows = await fetch_all(
        engine,
        "SELECT domain, county, state_code, dismissed_by FROM ui.dismissed_suggestions",
    )
    assert [(r["domain"], r["county"], r["state_code"]) for r in rows] == [
        ("denverite.com", "Jefferson", "CO")
    ]
    assert rows[0]["dismissed_by"] is not None
    repeat = await operator_client.post(
        "/app/sources/dismiss",
        json={"domain": "denverite.com", "county": "Jefferson", "state_code": "CO"},
    )
    assert repeat.status_code == 204
    assert len(await fetch_all(engine, "SELECT 1 FROM ui.dismissed_suggestions")) == 1


async def test_viewers_see_everything_but_change_nothing(
    viewer_client, operator_client
):
    source = await add(operator_client)
    for method, path, body in (
        ("POST", "/app/sources", ORLANDO),
        ("PATCH", f"/app/sources/{source['id']}", {"name": "x"}),
        ("DELETE", f"/app/sources/{source['id']}", None),
        ("POST", f"/app/sources/{source['id']}/restore", None),
        ("POST", "/app/sources/promote", {"suggestion": {}}),
        (
            "POST",
            "/app/sources/dismiss",
            {"domain": "a.com", "county": "O", "state_code": "FL"},
        ),
    ):
        response = await viewer_client.request(method, path, json=body)
        assert response.status_code == 403, (method, path, response.text)
        assert response.json()["error_category"] == "operator_required"
    upload = await viewer_client.post(
        "/app/sources/import",
        files={"file": ("x.csv", b"name,url,county,state\n", "text/csv")},
    )
    assert upload.status_code == 403
    assert (await viewer_client.get("/app/sources")).status_code == 200


@pytest.fixture
def stats_capable_pipeline(pipeline):
    """Test-local: teach the stub `GET /v1/sources/stats?domain=` (pipeline PR B2)."""
    pipeline.openapi["paths"]["/v1/sources/stats"] = {
        "get": {"parameters": [{"name": "domain", "in": "query"}], "responses": {}}
    }
    stats = {
        "orlandomagazine.com": {
            "accepted_articles": 18,
            "candidates": 142,
            "ratio": 18 / 142,
        },
        "rangewire.com": {"accepted_articles": 9, "candidates": 88, "ratio": 9 / 88},
    }

    def dispatch(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sources/stats":
            domain = dict(request.url.params).get("domain", "")
            if domain not in stats:
                return httpx.Response(200, json={"items": [], "next_cursor": None})
            row = {
                "domain": domain,
                **stats[domain],
                "last_job_id": "job-1",
                "last_job_at": "2026-10-04",
                "basis": "site_run_candidates_v1",
                "complete": True,
            }
            return httpx.Response(200, json={"items": [row], "next_cursor": None})
        return httpx.Response(404)

    pipeline.router.route(method="GET", path="/v1/sources/stats").mock(
        side_effect=dispatch
    )
    return pipeline


async def test_precision_when_the_sources_stats_capability_exists(
    stats_capable_pipeline, operator_client
):
    assert operator_client.me["capabilities"]["sources_stats"] is True
    await add(operator_client)
    await add(operator_client, name="Range Wire", url="https://rangewire.com",
              county="Jefferson", state_code="CO")  # fmt: skip
    await add(
        operator_client, name="Unknown", url="https://unknown.example", county="Lake"
    )
    body = (await operator_client.get("/app/sources")).json()
    by_domain = {item["domain"]: item["precision"] for item in body["items"]}
    assert by_domain["orlandomagazine.com"] == {
        "accepted": 18,
        "candidates": 142,
        "ratio": 18 / 142,
        "job_id": "job-1",
        "at": "2026-10-04",
        "basis": "site_run_candidates_v1",
        "complete": True,
    }
    assert by_domain["rangewire.com"]["ratio"] == 9 / 88
    assert by_domain["unknown.example"] is None
    assert body["stats"]["median_precision"] == pytest.approx((18 / 142 + 9 / 88) / 2)
