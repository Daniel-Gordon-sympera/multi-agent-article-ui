"""Saved views: CRUD, sharing, uniqueness (409 view_exists) and ownership rules."""

from __future__ import annotations

import uuid

from tests.conftest import fetch_all

FLORIDA = {
    "name": "Florida construction",
    "route": "/signals",
    "search": {"state": "FL", "job_industry": "Construction"},
    "columns": ["record", "hqCity", "date"],
}


async def test_create_list_patch_delete_own_view(operator_client, engine):
    created = await operator_client.post("/app/views", json=FLORIDA)
    assert created.status_code == 201, created.text
    view = created.json()
    assert view["name"] == "Florida construction"
    assert view["route"] == "/signals"
    assert view["search"] == FLORIDA["search"]
    assert view["columns"] == ["record", "hqCity", "date"]
    assert view["shared"] is False
    assert view["user_id"] == operator_client.me["user"]["id"]
    uuid.UUID(view["id"])

    listed = await operator_client.get("/app/views", params={"route": "/signals"})
    assert [v["id"] for v in listed.json()["items"]] == [view["id"]]
    other_route = await operator_client.get("/app/views", params={"route": "/jobs"})
    assert other_route.json()["items"] == []

    patched = await operator_client.patch(
        f"/app/views/{view['id']}",
        json={"name": "FL builders", "shared": True, "columns": None},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "FL builders"
    assert patched.json()["shared"] is True
    assert patched.json()["columns"] is None
    assert patched.json()["search"] == FLORIDA["search"]

    rows = await fetch_all(engine, "SELECT name, shared FROM ui.saved_views")
    assert rows == [{"name": "FL builders", "shared": True}]

    deleted = await operator_client.delete(f"/app/views/{view['id']}")
    assert deleted.status_code == 204
    assert (await operator_client.get("/app/views")).json()["items"] == []
    missing = await operator_client.delete(f"/app/views/{view['id']}")
    assert missing.status_code == 404
    assert missing.json()["error_category"] == "view_not_found"


async def test_duplicate_name_per_user_and_route_is_a_409(operator_client):
    assert (await operator_client.post("/app/views", json=FLORIDA)).status_code == 201
    duplicate = await operator_client.post("/app/views", json=FLORIDA)
    assert duplicate.status_code == 409
    assert duplicate.json()["error_category"] == "view_exists"
    elsewhere = await operator_client.post(
        "/app/views", json={**FLORIDA, "route": "/jobs"}
    )
    assert elsewhere.status_code == 201
    renamed = await operator_client.post(
        "/app/views", json={**FLORIDA, "name": "High materiality"}
    )
    assert renamed.status_code == 201
    collision = await operator_client.patch(
        f"/app/views/{renamed.json()['id']}", json={"name": "Florida construction"}
    )
    assert collision.status_code == 409
    assert collision.json()["error_category"] == "view_exists"


async def test_shared_views_are_visible_but_owned(client_factory):
    owner = await client_factory("operator", email="owner@example.com")
    viewer = await client_factory("viewer", email="viewer@example.com")
    admin = await client_factory("admin", email="admin@example.com")

    private = (await owner.post("/app/views", json=FLORIDA)).json()
    shared = (
        await owner.post(
            "/app/views", json={**FLORIDA, "name": "Everyone's view", "shared": True}
        )
    ).json()
    own = (
        await viewer.post(
            "/app/views", json={"name": "Mine", "route": "/signals", "search": {}}
        )
    ).json()

    names = [v["name"] for v in (await viewer.get("/app/views")).json()["items"]]
    assert names == ["Everyone's view", "Mine"]
    assert private["id"] not in [
        v["id"] for v in (await viewer.get("/app/views")).json()["items"]
    ]

    forbidden = await viewer.patch(
        f"/app/views/{shared['id']}", json={"name": "Hijack"}
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["error_category"] == "forbidden"
    assert (await viewer.delete(f"/app/views/{shared['id']}")).status_code == 403
    assert (await viewer.delete(f"/app/views/{own['id']}")).status_code == 204

    by_admin = await admin.patch(f"/app/views/{shared['id']}", json={"shared": False})
    assert by_admin.status_code == 200 and by_admin.json()["shared"] is False
    assert (await admin.delete(f"/app/views/{private['id']}")).status_code == 204


async def test_validation_and_csrf(operator_client, client):
    bad = await operator_client.post(
        "/app/views", json={"name": "", "route": "/signals", "search": {}}
    )
    assert bad.status_code == 422
    bad_route = await operator_client.post(
        "/app/views", json={"name": "x", "route": "signals", "search": {}}
    )
    assert bad_route.status_code == 422
    unknown = await operator_client.patch(
        f"/app/views/{uuid.uuid4()}", json={"name": "x"}
    )
    assert unknown.status_code == 404
    not_a_uuid = await operator_client.delete("/app/views/not-a-uuid")
    assert not_a_uuid.status_code == 404
    anonymous = await client.get("/app/views")
    assert anonymous.status_code == 401
    # a signed-in client without the CSRF headers may not mutate
    stripped = operator_client.headers.copy()
    try:
        del operator_client.headers["X-CSRF-Token"]
        response = await operator_client.post("/app/views", json=FLORIDA)
        assert response.status_code == 403
        assert response.json()["error_category"] == "csrf_failed"
    finally:
        operator_client.headers = stripped
