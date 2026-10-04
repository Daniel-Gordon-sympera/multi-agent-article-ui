"""Admin user management: CRUD, case-insensitive e-mail, self-protection, resets."""

from tests.conftest import DEFAULT_PASSWORD, fetch_all, new_client, sign_in

NEW_USER = {
    "email": "Carol@Example.com",
    "name": "Carol",
    "role": "operator",
    "password": "carol-initial-pw",
}


async def test_create_list_and_sign_in_as_new_user(admin_client, app):
    created = await admin_client.post("/app/users", json=NEW_USER)
    assert created.status_code == 201, created.text
    user = created.json()
    assert user["email"] == "Carol@Example.com"
    assert user["role"] == "operator"
    assert user["must_change_password"] is True
    assert user["disabled_at"] is None
    assert set(user) == {
        "id",
        "email",
        "name",
        "role",
        "must_change_password",
        "created_at",
        "disabled_at",
        "last_login_at",
    }
    listed = await admin_client.get("/app/users")
    assert listed.status_code == 200
    emails = [row["email"] for row in listed.json()["items"]]
    assert "Carol@Example.com" in emails and listed.json()["next_cursor"] is None
    async with new_client(app) as carol:
        me = await sign_in(carol, "carol@example.com", "carol-initial-pw")
    assert me["user"]["must_change_password"] is True


async def test_duplicate_email_is_case_insensitive_409(admin_client):
    assert (await admin_client.post("/app/users", json=NEW_USER)).status_code == 201
    duplicate = await admin_client.post(
        "/app/users", json={**NEW_USER, "email": "CAROL@example.COM"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error_category"] == "email_exists"


async def test_create_validation(admin_client):
    bad_email = await admin_client.post("/app/users", json={**NEW_USER, "email": "x"})
    assert bad_email.status_code == 422
    assert bad_email.json()["error_category"] == "validation_error"
    weak = await admin_client.post("/app/users", json={**NEW_USER, "password": "short"})
    assert weak.status_code == 422 and weak.json()["error_category"] == "weak_password"
    bad_role = await admin_client.post("/app/users", json={**NEW_USER, "role": "root"})
    assert bad_role.status_code == 422


async def test_patch_name_role_and_disable(admin_client, app, make_user, engine):
    target = await make_user("dave@example.com", role="viewer")
    async with new_client(app) as dave:
        await sign_in(dave, "dave@example.com", DEFAULT_PASSWORD)
        patched = await admin_client.patch(
            f"/app/users/{target['id']}", json={"name": "David", "role": "operator"}
        )
        assert patched.status_code == 200
        assert patched.json()["name"] == "David"
        assert patched.json()["role"] == "operator"
        assert (await dave.get("/app/auth/me")).json()["user"]["role"] == "operator"
        disabled = await admin_client.patch(
            f"/app/users/{target['id']}", json={"disabled": True}
        )
        assert disabled.status_code == 200
        assert disabled.json()["disabled_at"] is not None
        assert (await dave.get("/app/auth/me")).status_code == 401
    assert (
        await fetch_all(
            engine, "SELECT * FROM ui.sessions WHERE user_id = :id", id=target["id"]
        )
        == []
    )
    enabled = await admin_client.patch(
        f"/app/users/{target['id']}", json={"disabled": False}
    )
    assert enabled.json()["disabled_at"] is None
    missing = await admin_client.patch(
        "/app/users/00000000-0000-0000-0000-000000000000", json={"name": "x"}
    )
    assert missing.status_code == 404
    assert missing.json()["error_category"] == "user_not_found"


async def test_admin_cannot_disable_or_demote_themselves(admin_client):
    me = (await admin_client.get("/app/auth/me")).json()["user"]
    for payload in ({"disabled": True}, {"role": "operator"}, {"role": "viewer"}):
        response = await admin_client.patch(f"/app/users/{me['id']}", json=payload)
        assert response.status_code == 409, payload
        assert response.json()["error_category"] == "self_protection"
    renamed = await admin_client.patch(
        f"/app/users/{me['id']}", json={"name": "Renamed", "role": "admin"}
    )
    assert renamed.status_code == 200 and renamed.json()["name"] == "Renamed"


async def test_admin_password_reset_forces_change_and_revokes_sessions(
    admin_client, app, make_user
):
    target = await make_user("erin@example.com", role="operator")
    async with new_client(app) as erin:
        await sign_in(erin, "erin@example.com", DEFAULT_PASSWORD)
        reset = await admin_client.post(
            f"/app/users/{target['id']}/password", json={"new_password": "reset-pw-123"}
        )
        assert reset.status_code == 204
        assert (await erin.get("/app/auth/me")).status_code == 401
        me = await sign_in(erin, "erin@example.com", "reset-pw-123")
        assert me["user"]["must_change_password"] is True
    weak = await admin_client.post(
        f"/app/users/{target['id']}/password", json={"new_password": "short"}
    )
    assert weak.status_code == 422
    missing = await admin_client.post(
        "/app/users/00000000-0000-0000-0000-000000000000/password",
        json={"new_password": "reset-pw-123"},
    )
    assert missing.status_code == 404


async def test_admin_resetting_own_password_keeps_current_session(admin_client):
    me = (await admin_client.get("/app/auth/me")).json()["user"]
    reset = await admin_client.post(
        f"/app/users/{me['id']}/password", json={"new_password": "another-pw-123"}
    )
    assert reset.status_code == 204
    after = await admin_client.get("/app/auth/me")
    assert after.status_code == 200
    assert after.json()["user"]["must_change_password"] is True


async def test_non_admins_are_rejected(operator_client, viewer_client, make_user):
    target = await make_user("frank@example.com")
    for client in (operator_client, viewer_client):
        assert (await client.post("/app/users", json=NEW_USER)).status_code == 403
        assert (
            await client.patch(f"/app/users/{target['id']}", json={"name": "F"})
        ).status_code == 403
        assert (
            await client.post(
                f"/app/users/{target['id']}/password", json={"new_password": "x" * 12}
            )
        ).status_code == 403
