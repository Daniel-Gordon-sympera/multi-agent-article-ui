"""create_app(): routers, proxy, SPA, error handlers, security headers, lifespan."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff import capabilities as capabilities_module
from scout_bff.attention import router as attention_router
from scout_bff.audit import AuditMiddleware
from scout_bff.auth import router as auth_router
from scout_bff.auth.sessions import CookieCodec
from scout_bff.batches import router as batches_router
from scout_bff.capabilities import CapabilityCache
from scout_bff.db import create_database_engine, database_reachable, migrations_current
from scout_bff.errors import install_error_handlers, problem_response
from scout_bff.estimate import router as estimate_router
from scout_bff.jobs import router as jobs_router
from scout_bff.logging import RequestLoggingMiddleware, configure_logging, get_logger
from scout_bff.overview import router as overview_router
from scout_bff.pipeline_client import PipelineClient, PipelineError
from scout_bff.prefs import router as prefs_router
from scout_bff.proxy import router as proxy_router
from scout_bff.proxy.client import create_pipeline_http_client
from scout_bff.retention import run_retention
from scout_bff.scouts import router as scouts_router
from scout_bff.security import SecurityHeadersMiddleware
from scout_bff.settings import Settings
from scout_bff.signals import router as signals_router
from scout_bff.sources import router as sources_router
from scout_bff.static import mount_spa
from scout_bff.system import router as system_router
from scout_bff.users import router as users_router
from scout_bff.version import __version__
from scout_bff.views import router as views_router

logger = get_logger("scout_bff.app")

# Feature aggregates (scouts … jobs) are placeholders until A4–A7 fill them.
# Register new routers HERE: everything included after mount_spa() would be
# shadowed by the SPA's GET catch-all when the static folder exists.
APP_ROUTERS = (
    auth_router.router,
    users_router.router,
    capabilities_module.router,
    scouts_router.router,
    batches_router.router,
    sources_router.router,
    views_router.router,
    prefs_router.router,
    attention_router.router,
    system_router.router,
    overview_router.router,
    signals_router.router,
    estimate_router.router,
    jobs_router.router,
)


def create_app(
    settings: Settings | None = None,
    engine: AsyncEngine | None = None,
    pipeline: httpx.AsyncClient | None = None,
    *,
    static_directory: Path | None = None,
    background_tasks: bool = True,
) -> FastAPI:
    """Build the BFF; injected engine/pipeline clients are not closed on shutdown."""
    settings = settings or Settings()
    configure_logging(settings)
    owns_engine, owns_http = engine is None, pipeline is None
    engine = engine or create_database_engine(settings)
    http = pipeline or create_pipeline_http_client(settings)
    pipeline_client = PipelineClient(http, settings)
    capability_cache = CapabilityCache(
        pipeline_client, settings.ui_capability_refresh_seconds
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.started_at = datetime.now(timezone.utc)
        tasks: list[asyncio.Task[Any]] = []
        if background_tasks:
            tasks.append(asyncio.create_task(capability_cache.run(), name="caps"))
            tasks.append(
                asyncio.create_task(run_retention(engine, settings), name="retention")
            )
        else:
            await capability_cache.probe()
        logger.info("bff_started", version=__version__)
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                try:
                    await task
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
            if owns_http:
                await http.aclose()
            if owns_engine:
                await engine.dispose()

    app = FastAPI(title="Sympera Scout BFF", version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.http = http
    app.state.pipeline = pipeline_client
    app.state.capabilities = capability_cache
    app.state.cookie_codec = CookieCodec(settings)
    app.state.started_at = None
    install_error_handlers(app)
    install_pipeline_error_handler(app)
    # Innermost first: audit sees the final status; logging wraps everything.
    app.add_middleware(AuditMiddleware, engine=engine)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    for router in APP_ROUTERS:
        app.include_router(router)
    app.include_router(proxy_router.router)
    add_health_routes(app, engine, capability_cache)
    app.state.spa_mounted = mount_spa(app, static_directory)
    return app


def install_pipeline_error_handler(app: FastAPI) -> None:
    """An unhandled PipelineError keeps the upstream status and category."""

    @app.exception_handler(PipelineError)
    async def pipeline_error(request: Request, error: PipelineError):
        return problem_response(
            request, error.status, error.category, error.detail, **error.extra
        )


def add_health_routes(
    app: FastAPI, engine: AsyncEngine, capability_cache: CapabilityCache
) -> None:
    @app.get("/healthz", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz", tags=["health"])
    async def ready() -> JSONResponse:
        checks = {"database": False, "migrations": False, "pipeline_api": False}
        try:
            checks["database"] = await database_reachable(engine)
            checks["migrations"] = await migrations_current(engine)
        except Exception:  # noqa: BLE001 - a stopped database is "not ready"
            checks["database"] = False
        checks["pipeline_api"] = await capability_cache.check_ready()
        ready_now = all(checks.values())
        return JSONResponse(
            {"status": "ready" if ready_now else "not_ready", "checks": checks},
            status_code=200 if ready_now else 503,
        )


class LazyApplication:
    """ASGI entry point `scout_bff.app:app`; reads settings on the first call."""

    def __init__(self) -> None:
        self._app: FastAPI | None = None

    @property
    def fastapi(self) -> FastAPI:
        if self._app is None:
            self._app = create_app()
        return self._app

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        await self.fastapi(scope, receive, send)


app = LazyApplication()
