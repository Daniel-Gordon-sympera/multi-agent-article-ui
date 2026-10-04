"""Sign-in, cookie, sessions (expiry, renewal, absolute limit), logout, passwords."""

from datetime import timedelta

import httpx
from argon2 import PasswordHasher
from sqlalchemy import text

from scout_bff.app import create_app
from scout_bff.auth.passwords import needs_rehash
from scout_bff.auth.sessions import COOKIE_NAME
from tests.conftest import (
    DEFAULT_PASSWORD,
    build_settings,
    fetch_all,
    new_client,
    sign_in,
)

SCOUT = {"X-Requested-With": "scout"}


async def login(client, email, password):
    return await client.post(
        "/app/auth/login", json={"email": email, "password": password}, headers=SCOUT
    )


async def test_login_sets_cookie_and_session_row(client, make_user, engine):
    user = await make_user("alice@example.com", role="viewer")
    response = await login(client, "Alice@Example.com", DEFAULT_PASSWORD)
    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE_NAME}=")
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Secure" not in cookie  # test settings use plain http
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["user"] == {
        "id": user["id"],
        "email": "alice@example.com",
        "name": "Alice",
        "role": "viewer",
        "must_change_password": False,
        "created_at": user["created_at"],
    }
    sessions = await fetch_all(engine, "SELECT * FROM ui.sessions")
    assert len(sessions) == 1
    assert sessions[0]["csrf_token"] == body["csrf_token"]
    assert sessions[0]["ip"] is not None
    assert sessions[0]["user_agent"].startswith("python-httpx")
    assert sessions[0]["expires_at"] - sessions[0]["created_at"] == timedelta(hours=12)
    users = await fetch_all(engine, "SELECT last_login_at FROM ui.users")
    assert users[0]["last_login_at"] is not None


async def test_secure_cookie_when_enabled(engine, pipeline, make_user):
    await make_user("alice@example.com")
    app = create_app(
        build_settings(ui_secure_cookies=True),
        engine,
        pipeline.http_client(),
        background_tasks=False,
    )
    async with new_client(app) as client:
        response = await login(client, "alice@example.com", DEFAULT_PASSWORD)
    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]


async def test_invalid_credentials_never_reveal_accounts(client, make_user, engine):
    await make_user("alice@example.com")
    wrong = await login(client, "alice@example.com", "wrong-password")
    unknown = await login(client, "nobody@example.com", DEFAULT_PASSWORD)
    for response in (wrong, unknown):
        assert response.status_code == 401
        assert response.json()["error_category"] == "invalid_credentials"
        assert response.json()["detail"] == wrong.json()["detail"]
        assert "set-cookie" not in response.headers
    attempts = await fetch_all(engine, "SELECT key FROM ui.login_attempts ORDER BY key")
    assert {row["key"] for row in attempts} >= {
        "email:alice@example.com",
        "email:nobody@example.com",
    }


async def test_disabled_user_cannot_sign_in_and_is_signed_out(
    client, make_user, engine
):
    user = await make_user("alice@example.com")
    await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE ui.users SET disabled_at = now() WHERE id = :id"),
            {"id": user["id"]},
        )
    assert (await client.get("/app/auth/me")).status_code == 401
    assert (
        await login(client, "alice@example.com", DEFAULT_PASSWORD)
    ).status_code == 401


async def test_tampered_or_unknown_cookie_is_anonymous(client, make_user):
    await make_user("alice@example.com")
    me = await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    assert me["csrf_token"]
    client.cookies.set(COOKIE_NAME, "forged.value.here")
    response = await client.get("/app/auth/me")
    assert response.status_code == 401
    assert response.json()["error_category"] == "not_authenticated"


async def test_logout_deletes_the_session_and_clears_the_cookie(
    client, make_user, engine
):
    await make_user("alice@example.com")
    await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    response = await client.post("/app/auth/logout")
    assert response.status_code == 204
    assert 'scout_session=""' in response.headers["set-cookie"]
    assert await fetch_all(engine, "SELECT id FROM ui.sessions") == []
    assert (await client.get("/app/auth/me")).status_code == 401


async def test_idle_expiry_and_sliding_renewal(client, make_user, engine):
    await make_user("alice@example.com")
    await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "UPDATE ui.sessions SET last_seen_at = now() - interval '11 hours', "
                "expires_at = now() + interval '1 hour'"
            )
        )
    assert (await client.get("/app/auth/me")).status_code == 200
    row = (await fetch_all(engine, "SELECT * FROM ui.sessions"))[0]
    assert row["expires_at"] - row["last_seen_at"] == timedelta(hours=12)
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE ui.sessions SET expires_at = now() - interval '1 second'")
        )
    assert (await client.get("/app/auth/me")).status_code == 401


async def test_absolute_expiry_caps_renewal(client, make_user, engine):
    await make_user("alice@example.com")
    await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "UPDATE ui.sessions SET created_at = now() - interval '6 days 23 hours',"
                " last_seen_at = now() - interval '2 hours', "
                "expires_at = now() + interval '1 hour'"
            )
        )
    assert (await client.get("/app/auth/me")).status_code == 200
    row = (await fetch_all(engine, "SELECT * FROM ui.sessions"))[0]
    assert row["expires_at"] - row["created_at"] == timedelta(days=7)


async def test_renewal_is_skipped_within_a_minute(client, make_user, engine):
    await make_user("alice@example.com")
    await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    before = (await fetch_all(engine, "SELECT * FROM ui.sessions"))[0]
    await client.get("/app/auth/me")
    after = (await fetch_all(engine, "SELECT * FROM ui.sessions"))[0]
    assert before["last_seen_at"] == after["last_seen_at"]


async def test_password_change_flow(client, make_user, engine, app):
    await make_user("alice@example.com", must_change_password=True)
    me = await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    assert me["user"]["must_change_password"] is True
    other = new_client(app)
    await sign_in(other, "alice@example.com", DEFAULT_PASSWORD)
    bad = await client.post(
        "/app/auth/password",
        json={"current_password": "nope", "new_password": "brand-new-password"},
    )
    assert bad.status_code == 403
    assert bad.json()["error_category"] == "invalid_credentials"
    weak = await client.post(
        "/app/auth/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "short"},
    )
    assert weak.status_code == 422 and weak.json()["error_category"] == "weak_password"
    same = await client.post(
        "/app/auth/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": DEFAULT_PASSWORD},
    )
    assert same.status_code == 422
    good = await client.post(
        "/app/auth/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "brand-new-pw"},
    )
    assert good.status_code == 204
    assert (await client.get("/app/auth/me")).json()["user"][
        "must_change_password"
    ] is False
    assert (
        await other.get("/app/auth/me")
    ).status_code == 401  # other sessions revoked
    await other.aclose()
    assert (
        await login(client, "alice@example.com", DEFAULT_PASSWORD)
    ).status_code == 401
    assert (await login(client, "alice@example.com", "brand-new-pw")).status_code == 200


async def test_legacy_hash_is_rehashed_on_login(client, make_user, engine):
    user = await make_user("alice@example.com")
    weak_hasher = PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    legacy = weak_hasher.hash(DEFAULT_PASSWORD)
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE ui.users SET password_hash = :hash WHERE id = :id"),
            {"hash": legacy, "id": user["id"]},
        )
    assert (
        await login(client, "alice@example.com", DEFAULT_PASSWORD)
    ).status_code == 200
    stored = (await fetch_all(engine, "SELECT password_hash FROM ui.users"))[0]
    assert stored["password_hash"] != legacy
    assert not needs_rehash(stored["password_hash"])


async def test_two_clients_have_independent_sessions(client_factory):
    first = await client_factory("viewer", email="one@example.com")
    second = await client_factory("operator", email="two@example.com")
    assert (await first.get("/app/auth/me")).json()["user"]["role"] == "viewer"
    assert (await second.get("/app/auth/me")).json()["user"]["role"] == "operator"
    assert isinstance(first, httpx.AsyncClient)
