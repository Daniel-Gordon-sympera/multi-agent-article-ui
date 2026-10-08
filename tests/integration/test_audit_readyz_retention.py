"""Audit rows, /readyz and /healthz, retention purge, live capabilities, lifespan."""

import asyncio

from asgi_lifespan import LifespanManager
from sqlalchemy import text

from scout_bff.app import create_app
from scout_bff.retention import purge_once
from tests.conftest import DEFAULT_PASSWORD, build_settings, fetch_all, new_client
from tests.pipeline_fixtures import DEAD_TASK_ID, JOB_ANALYSING


async def audit_rows(engine):
    return await fetch_all(engine, "SELECT * FROM ui.audit_log ORDER BY id")


async def test_audit_rows_for_unsafe_app_and_proxy_calls(admin_client, engine):
    me = (await admin_client.get("/app/auth/me")).json()["user"]
    created = await admin_client.post(
        "/app/users",
        json={
            "email": "g@example.com",
            "name": "G",
            "role": "viewer",
            "password": "g-password-123",
        },
    )
    assert created.status_code == 201
    retried = await admin_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    assert retried.status_code == 202
    assert (await admin_client.get("/v1/jobs")).status_code == 200  # not audited
    denied = await admin_client.post("/v1/jobs/x/not-a-route")
    assert denied.status_code == 404
    rows = await audit_rows(engine)
    paths = [(row["method"], row["path"], row["status"]) for row in rows]
    assert paths == [
        ("POST", "/app/auth/login", 200),
        ("POST", "/app/users", 201),
        ("POST", f"/v1/tasks/{DEAD_TASK_ID}/retry", 202),
        ("POST", "/v1/jobs/x/not-a-route", 404),
    ]
    for row in rows:
        assert str(row["user_id"]) == me["id"]
        assert row["role"] == "admin"
        assert row["duration_ms"] >= 0
    assert rows[1]["target"] == {"user_id": created.json()["id"]}
    assert rows[2]["target"] == {"path": f"/v1/tasks/{DEAD_TASK_ID}/retry"}
    assert rows[3]["target"] == {"path": "/v1/jobs/x/not-a-route"}


async def test_failed_login_is_audited_without_a_user(client, make_user, engine):
    await make_user("alice@example.com")
    await client.post(
        "/app/auth/login",
        json={"email": "alice@example.com", "password": "nope"},
        headers={"X-Requested-With": "scout"},
    )
    rows = await audit_rows(engine)
    assert len(rows) == 1
    assert rows[0]["status"] == 401 and rows[0]["user_id"] is None
    assert rows[0]["target"] is None


async def test_healthz_and_readyz(client, pipeline):
    assert (await client.get("/healthz")).json() == {"status": "ok"}
    ready = await client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json() == {
        "status": "ready",
        "checks": {"database": True, "migrations": True, "pipeline_api": True},
    }
    pipeline.down = True
    degraded = await client.get("/readyz")
    assert degraded.status_code == 503
    assert degraded.json()["status"] == "not_ready"
    assert degraded.json()["checks"]["pipeline_api"] is False
    assert degraded.json()["checks"]["database"] is True
    pipeline.down = False
    pipeline.ready = False
    assert (await client.get("/readyz")).json()["checks"]["pipeline_api"] is False
    pipeline.ready = True
    assert (await client.get("/readyz")).status_code == 200


async def test_readyz_detects_missing_migration_head(client, engine):
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE ui.alembic_version SET version_num = '0000_older'")
        )
    try:
        response = await client.get("/readyz")
        assert response.status_code == 503
        assert response.json()["checks"]["migrations"] is False
    finally:
        async with engine.begin() as connection:
            await connection.execute(
                text("UPDATE ui.alembic_version SET version_num = '0001_ui_schema'")
            )


async def test_retention_purge(engine, make_user, test_settings):
    user = await make_user("alice@example.com")
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO ui.sessions(id, user_id, csrf_token, expires_at) VALUES "
                "('old', :user_id, 'c', now() - interval '1 minute'), "
                "('live', :user_id, 'c', now() + interval '1 hour')"
            ),
            {"user_id": user["id"]},
        )
        await connection.execute(
            text(
                "INSERT INTO ui.login_attempts(key, at) VALUES "
                "('email:x', now() - interval '25 hours'), ('email:y', now())"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO ui.audit_log(at, method, path) VALUES "
                "(now() - interval '200 days', 'POST', '/old'), (now(), 'POST', '/new')"
            )
        )
    removed = await purge_once(engine, test_settings.ui_audit_retention_days)
    assert removed == {"sessions": 1, "login_attempts": 1, "audit_log": 1}
    assert [r["id"] for r in await fetch_all(engine, "SELECT id FROM ui.sessions")] == [
        "live"
    ]
    assert [
        r["path"] for r in await fetch_all(engine, "SELECT path FROM ui.audit_log")
    ] == ["/new"]


async def test_capabilities_endpoint_and_me_reflect_the_probe(client_factory, pipeline):
    viewer = await client_factory("viewer")
    response = await viewer.get("/app/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert body["pipeline_api_version"] == "1.0.0"
    assert body["probed_at"] and body["probe_error"] is None
    assert body["capabilities"]["signals_global"] is True
    assert viewer.me["api"]["ready"] is True  # type: ignore[attr-defined]
    assert viewer.me["api"]["checked_at"]  # type: ignore[attr-defined]


async def test_capabilities_true_when_the_pipeline_grows_a_signals_route(
    engine, make_user
):
    from tests.pipeline_stub import PipelineStub

    stub = PipelineStub()
    stub.openapi["paths"]["/v1/signals"] = {"get": {"responses": {"200": {}}}}
    app = create_app(
        build_settings(), engine, stub.http_client(), background_tasks=False
    )
    await make_user("alice@example.com")
    async with LifespanManager(app):
        async with new_client(app) as client:
            response = await client.post(
                "/app/auth/login",
                json={"email": "alice@example.com", "password": DEFAULT_PASSWORD},
                headers={"X-Requested-With": "scout"},
            )
    capabilities = response.json()["capabilities"]
    assert capabilities["signals_global"] is True
    assert capabilities["tasks_global"] is True


async def test_lifespan_runs_and_stops_background_tasks(engine, pipeline):
    settings = build_settings(ui_capability_refresh_seconds=5)
    app = create_app(settings, engine, pipeline.http_client(), background_tasks=True)
    async with LifespanManager(app):
        for _ in range(50):
            if app.state.capabilities.probed_at:
                break
            await asyncio.sleep(0.02)
        assert app.state.capabilities.probed_at is not None
        assert app.state.started_at is not None
        async with new_client(app) as client:
            assert (await client.get("/readyz")).status_code == 200
    # Shutdown cancelled the probe and retention tasks without raising.
    assert pipeline.calls.called


async def test_proxied_get_is_not_audited_but_logged(operator_client, engine):
    response = await operator_client.get(f"/v1/jobs/{JOB_ANALYSING}")
    assert response.status_code == 200
    rows = await audit_rows(engine)
    assert [row["path"] for row in rows] == ["/app/auth/login"]
