"""Shared fixtures: stub pipeline API, scratch database, app/client factories."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import httpx
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import create_engine, text

from scout_bff.app import create_app
from scout_bff.auth.csrf import CSRF_TOKEN_HEADER, REQUESTED_WITH_HEADER
from scout_bff.bootstrap import BootstrapReport, run_bootstrap
from scout_bff.db import create_database_engine, database_url
from scout_bff.settings import Settings
from scout_bff.users import repository as users
from tests.pipeline_fixtures import OPERATOR_KEY, PIPELINE_URL, READER_KEY
from tests.pipeline_stub import PipelineStub

TEST_DATABASE_URL = os.environ.get("UI_TEST_DATABASE_URL")
SKIP_REASON = (
    "UI_TEST_DATABASE_URL is not set; integration tests need the owner URL of a "
    "scratch PostgreSQL database (schema ui is dropped and recreated)."
)
SESSION_SECRET = "test-session-secret-with-at-least-32-characters"
APP_UI_PASSWORD = "scout-test-app-ui-password"
BOOTSTRAP_ADMIN_EMAIL = "bootstrap-admin@example.com"
BOOTSTRAP_ADMIN_PASSWORD = "bootstrap-admin-pass-1"
DEFAULT_PASSWORD = "correct-horse-battery"
TRUNCATE_TABLES = (
    "ui.audit_log",
    "ui.sessions",
    "ui.login_attempts",
    "ui.batch_jobs",
    "ui.batches",
    "ui.saved_views",
    "ui.preferences",
    "ui.sources",
    "ui.dismissed_suggestions",
    "ui.scouts",
    "ui.users",
)


def require_database() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip(SKIP_REASON)
    return TEST_DATABASE_URL


def build_settings(**overrides: Any) -> Settings:
    """App settings for tests: scratch database, stub pipeline, plain-http cookies."""
    values: dict[str, Any] = {
        "ui_database_url": TEST_DATABASE_URL or "postgresql+psycopg://x@localhost/x",
        "ui_database_password": APP_UI_PASSWORD,
        "pipeline_api_url": PIPELINE_URL,
        "pipeline_operator_key": OPERATOR_KEY,
        "pipeline_reader_key": READER_KEY,
        "session_secret": SESSION_SECRET,
        "ui_secure_cookies": False,
        "ui_bootstrap_admin_email": BOOTSTRAP_ADMIN_EMAIL,
        "ui_bootstrap_admin_password": BOOTSTRAP_ADMIN_PASSWORD,
        "log_format": "console",
        "log_level": "WARNING",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    require_database()
    return build_settings()


@pytest.fixture(scope="session")
def bootstrapped_database(test_settings: Settings) -> BootstrapReport:
    """Once per session: drop schema ui, then run the real bootstrap."""
    engine = create_engine(database_url(test_settings.ui_database_url))
    try:
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS ui CASCADE"))
        return run_bootstrap(test_settings, engine)
    finally:
        engine.dispose()


@pytest.fixture
async def engine(bootstrapped_database, test_settings: Settings):
    """Per test: a fresh async engine and empty tables."""
    engine = create_database_engine(test_settings)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {', '.join(TRUNCATE_TABLES)} CASCADE"))
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
def pipeline() -> PipelineStub:
    return PipelineStub()


@pytest.fixture
async def app(test_settings: Settings, engine, pipeline: PipelineStub):
    http = pipeline.http_client()
    application = create_app(test_settings, engine, http, background_tasks=False)
    async with LifespanManager(application):
        yield application
    await http.aclose()


def new_client(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    )


@pytest.fixture
async def client(app) -> AsyncIterator[httpx.AsyncClient]:
    """An anonymous client; use `sign_in` or `client_factory` for sessions."""
    async with new_client(app) as client:
        yield client


UserFactory = Callable[..., Awaitable[dict[str, Any]]]


@pytest.fixture
def make_user(engine) -> UserFactory:
    """Create a ui.users row directly; returns the user JSON plus `password`."""

    async def factory(
        email: str = "operator@example.com",
        *,
        password: str = DEFAULT_PASSWORD,
        role: str = "operator",
        name: str | None = None,
        must_change_password: bool = False,
        disabled: bool = False,
    ) -> dict[str, Any]:
        async with engine.begin() as connection:
            row = await users.create_user(
                connection,
                email=email,
                name=name or email.split("@")[0].title(),
                role=role,
                password=password,
                must_change_password=must_change_password,
            )
            if disabled:
                row = await users.update_user(connection, row["id"], disabled=True)
        return {**users.user_json(row), "password": password}

    return factory


async def sign_in(client: httpx.AsyncClient, email: str, password: str) -> dict:
    """POST /app/auth/login; sets the cookie jar and the CSRF headers on `client`."""
    response = await client.post(
        "/app/auth/login",
        json={"email": email, "password": password},
        headers={REQUESTED_WITH_HEADER: "scout"},
    )
    assert response.status_code == 200, response.text
    me = response.json()
    client.headers[REQUESTED_WITH_HEADER] = "scout"
    client.headers[CSRF_TOKEN_HEADER] = me["csrf_token"]
    return me


ClientFactory = Callable[..., Awaitable[httpx.AsyncClient]]


@pytest.fixture
async def client_factory(app, make_user: UserFactory) -> AsyncIterator[ClientFactory]:
    """`await client_factory("viewer")` → a signed-in client for a new user."""
    clients: list[httpx.AsyncClient] = []

    async def factory(
        role: str = "operator",
        *,
        email: str | None = None,
        password: str = DEFAULT_PASSWORD,
        must_change_password: bool = False,
    ) -> httpx.AsyncClient:
        user = await make_user(
            email or f"{role}-{len(clients)}@example.com",
            password=password,
            role=role,
            must_change_password=must_change_password,
        )
        client = new_client(app)
        clients.append(client)
        me = await sign_in(client, user["email"], password)
        client.me = me  # type: ignore[attr-defined]
        return client

    yield factory
    for client in clients:
        await client.aclose()


@pytest.fixture
async def operator_client(client_factory: ClientFactory) -> httpx.AsyncClient:
    return await client_factory("operator")


@pytest.fixture
async def admin_client(client_factory: ClientFactory) -> httpx.AsyncClient:
    return await client_factory("admin")


@pytest.fixture
async def viewer_client(client_factory: ClientFactory) -> httpx.AsyncClient:
    return await client_factory("viewer")


async def fetch_all(engine, sql: str, **parameters: Any) -> list[dict[str, Any]]:
    async with engine.connect() as connection:
        result = await connection.execute(text(sql), parameters)
        return [dict(row) for row in result.mappings().all()]
