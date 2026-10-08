"""App behaviour that needs no database: health, headers, SPA, problem shapes."""

import json

import httpx
import pytest
from asgi_lifespan import LifespanManager

from scout_bff.app import LazyApplication, create_app
from scout_bff.openapi import openapi_document
from scout_bff.security import CONTENT_SECURITY_POLICY
from scout_bff.settings import placeholder_settings
from scout_bff.version import __version__
from tests.pipeline_fixtures import OPERATOR_KEY, PIPELINE_URL, READER_KEY
from tests.pipeline_stub import PipelineStub

UNREACHABLE_DATABASE = "postgresql+psycopg://x:y@127.0.0.1:1/nowhere"


def settings_without_database(**overrides):
    return placeholder_settings(
        ui_database_url=UNREACHABLE_DATABASE,
        pipeline_api_url=PIPELINE_URL,
        pipeline_operator_key=OPERATOR_KEY,
        pipeline_reader_key=READER_KEY,
        **overrides,
    )


@pytest.fixture
async def client(tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<!doctype html><title>Sympera Scout</title>")
    (static / "assets" / "app-abc123.js").write_text("console.log('scout')")
    (static / "favicon.svg").write_text("<svg/>")
    stub = PipelineStub()
    app = create_app(
        settings_without_database(),
        pipeline=stub.http_client(),
        static_directory=static,
        background_tasks=False,
    )
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
            yield c


async def test_healthz_and_security_headers(client):
    response = await client.get("/healthz")
    assert response.status_code == 200 and response.json() == {"status": "ok"}
    assert response.headers["content-security-policy"] == CONTENT_SECURITY_POLICY
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "same-origin"
    assert response.headers["permissions-policy"] == (
        "camera=(), microphone=(), geolocation=()"
    )
    assert response.headers["x-frame-options"] == "DENY"
    assert len(response.headers["x-request-id"]) == 32


async def test_docs_pages_relax_only_their_own_csp(client):
    docs = await client.get("/docs")
    assert docs.status_code == 200
    assert "cdn.jsdelivr.net" in docs.headers["content-security-policy"]
    openapi = await client.get("/openapi.json")
    assert openapi.status_code == 200
    assert openapi.headers["content-security-policy"] == CONTENT_SECURITY_POLICY
    assert openapi.json()["info"]["title"] == "Sympera Scout BFF"


async def test_me_without_session_is_401_problem_json(client):
    response = await client.get("/app/auth/me")
    assert response.status_code == 401
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json() == {
        "type": "urn:sympera:problem:not_authenticated",
        "title": "Authentication required",
        "status": 401,
        "detail": "Sign in to use this resource.",
        "instance": "/app/auth/me",
        "error_category": "not_authenticated",
    }


async def test_validation_errors_follow_the_backend_shape(client):
    response = await client.post(
        "/app/auth/login",
        json={"email": "someone@example.com"},
        headers={"X-Requested-With": "scout"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error_category"] == "validation_error"
    assert body["title"] == "Invalid request"
    assert body["errors"][0]["location"] == ["body", "password"]
    assert set(body["errors"][0]) == {"location", "message"}


async def test_login_without_requested_with_header_is_csrf_failed(client):
    response = await client.post(
        "/app/auth/login", json={"email": "a@b.co", "password": "x"}
    )
    assert response.status_code == 403
    assert response.json()["error_category"] == "csrf_failed"


async def test_database_outage_is_503_database_unavailable(client):
    response = await client.post(
        "/app/auth/login",
        json={"email": "a@b.co", "password": "whatever"},
        headers={"X-Requested-With": "scout"},
    )
    assert response.status_code == 503
    assert response.json()["error_category"] == "database_unavailable"


async def test_readyz_reports_database_down_but_pipeline_up(client):
    response = await client.get("/readyz")
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": False, "migrations": False, "pipeline_api": True},
    }


async def test_static_spa_serving(client):
    index = await client.get("/jobs/0192f1c2")
    assert index.status_code == 200
    assert "Sympera Scout" in index.text
    assert index.headers["cache-control"] == "no-cache"
    assert index.headers["content-type"].startswith("text/html")
    asset = await client.get("/assets/app-abc123.js")
    assert asset.status_code == 200
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    favicon = await client.get("/favicon.svg")
    assert favicon.status_code == 200 and favicon.text == "<svg/>"
    missing_asset = await client.get("/assets/nope.js")
    assert missing_asset.status_code == 404
    traversal = await client.get("/..%2F..%2Fetc/passwd")
    assert traversal.status_code == 200 and "Sympera Scout" in traversal.text


async def test_unknown_api_paths_stay_problem_json_not_index(client):
    for path in ("/app/nothing", "/v1", "/healthz/x", "/app"):
        response = await client.get(path)
        assert response.status_code == 404, path
        assert response.headers["content-type"] == "application/problem+json"
        assert response.json()["status"] == 404


async def test_app_without_static_folder_returns_404_problem(tmp_path):
    app = create_app(
        settings_without_database(),
        pipeline=PipelineStub().http_client(),
        static_directory=tmp_path / "missing",
        background_tasks=False,
    )
    assert app.state.spa_mounted is False
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
            response = await c.get("/jobs")
    assert response.status_code == 404
    assert response.json()["error_category"] == "http_error"


def test_openapi_export_lists_core_routes_and_proxy():
    document = openapi_document()
    paths = document["paths"]
    assert document["info"] == {"title": "Sympera Scout BFF", "version": __version__}
    for path in (
        "/app/auth/login",
        "/app/auth/logout",
        "/app/auth/me",
        "/app/auth/password",
        "/app/users",
        "/app/users/{user_id}",
        "/app/users/{user_id}/password",
        "/app/capabilities",
        "/v1/{path}",
        "/healthz",
        "/readyz",
    ):
        assert path in paths, path
    assert set(paths["/v1/{path}"]) == {"get", "post", "put", "patch", "delete"}
    json.dumps(document)  # serialisable


def test_lazy_application_builds_on_first_access(monkeypatch):
    monkeypatch.setenv("UI_DATABASE_URL", UNREACHABLE_DATABASE)
    monkeypatch.setenv("PIPELINE_API_URL", PIPELINE_URL)
    monkeypatch.setenv("PIPELINE_OPERATOR_KEY", OPERATOR_KEY)
    monkeypatch.setenv("PIPELINE_READER_KEY", READER_KEY)
    monkeypatch.setenv("SESSION_SECRET", "x" * 32)
    lazy = LazyApplication()
    assert lazy._app is None
    assert lazy.fastapi.title == "Sympera Scout BFF"
    assert lazy.fastapi is lazy.fastapi
