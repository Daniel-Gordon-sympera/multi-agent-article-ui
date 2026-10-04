"""Login rate limits, CSRF on unsafe calls, roles and the password-change gate."""

from sqlalchemy import text

from scout_bff.auth.rate_limit import IP_RULE, attempt_key
from tests.conftest import DEFAULT_PASSWORD, sign_in

SCOUT = {"X-Requested-With": "scout"}


async def login(client, email, password):
    return await client.post(
        "/app/auth/login", json={"email": email, "password": password}, headers=SCOUT
    )


async def test_ten_failures_per_email_lock_the_account_for_the_window(
    client, make_user
):
    await make_user("alice@example.com")
    for _ in range(10):
        assert (await login(client, "alice@example.com", "wrong")).status_code == 401
    locked = await login(client, "alice@example.com", DEFAULT_PASSWORD)
    assert locked.status_code == 429
    assert locked.json()["error_category"] == "too_many_attempts"
    assert locked.headers["retry-after"] == "900"
    # Another account from the same client is still fine (below the IP limit).
    await make_user("bob@example.com")
    assert (await login(client, "bob@example.com", DEFAULT_PASSWORD)).status_code == 200


async def test_failures_expire_and_success_clears_the_email_counter(
    client, make_user, engine
):
    await make_user("alice@example.com")
    for _ in range(10):
        await login(client, "alice@example.com", "wrong")
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE ui.login_attempts SET at = at - interval '16 minutes'")
        )
    ok = await login(client, "alice@example.com", DEFAULT_PASSWORD)
    assert ok.status_code == 200
    async with engine.connect() as connection:
        remaining = await connection.scalar(
            text("SELECT count(*) FROM ui.login_attempts WHERE key LIKE 'email:%'")
        )
    assert remaining == 0


async def test_sixty_failures_per_ip_lock_the_client(client, engine, make_user):
    await make_user("alice@example.com")
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO ui.login_attempts(key) "
                "SELECT :key FROM generate_series(1, 60)"
            ),
            {"key": attempt_key(IP_RULE, "127.0.0.1")},
        )
    response = await login(client, "alice@example.com", DEFAULT_PASSWORD)
    assert response.status_code == 429
    assert response.headers["retry-after"] == "3600"


async def test_unsafe_calls_need_both_csrf_headers(client, make_user):
    await make_user("alice@example.com", role="admin")
    me = await sign_in(client, "alice@example.com", DEFAULT_PASSWORD)
    payload = {
        "email": "new@example.com",
        "name": "New",
        "role": "viewer",
        "password": "new-user-pass-1",
    }
    client.headers.pop("X-CSRF-Token")
    response = await client.post("/app/users", json=payload)
    assert response.status_code == 403
    assert response.json()["error_category"] == "csrf_failed"
    client.headers["X-CSRF-Token"] = "wrong"
    assert (await client.post("/app/users", json=payload)).status_code == 403
    client.headers["X-CSRF-Token"] = me["csrf_token"]
    client.headers.pop("X-Requested-With")
    assert (await client.post("/app/users", json=payload)).status_code == 403
    client.headers["X-Requested-With"] = "scout"
    assert (await client.post("/app/users", json=payload)).status_code == 201
    assert (await client.get("/app/users")).status_code == 200  # GET needs no token


async def test_role_requirements_on_app_routes(client_factory):
    viewer = await client_factory("viewer")
    operator = await client_factory("operator")
    for client in (viewer, operator):
        response = await client.get("/app/users")
        assert response.status_code == 403
        assert response.json()["error_category"] == "admin_required"
        assert (await client.get("/app/capabilities")).status_code == 200


async def test_password_change_gate(client_factory, engine):
    gated = await client_factory("admin", must_change_password=True)
    for method, path in (
        ("GET", "/app/users"),
        ("GET", "/app/capabilities"),
        ("GET", "/v1/jobs"),
        ("POST", "/app/users"),
    ):
        response = await gated.request(
            method, path, json={} if method == "POST" else None
        )
        assert response.status_code == 403, (method, path)
        assert response.json()["error_category"] == "password_change_required"
    assert (await gated.get("/app/auth/me")).status_code == 200
    changed = await gated.post(
        "/app/auth/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "fresh-password-1"},
    )
    assert changed.status_code == 204
    assert (await gated.get("/app/users")).status_code == 200
    assert (await gated.post("/app/auth/logout")).status_code == 204
