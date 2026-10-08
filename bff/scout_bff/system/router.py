"""GET /app/system, /app/system/queue, /app/system/dead-by-category, /app/system/maintenance."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.capabilities import CapabilityCache
from scout_bff.overview.cache import SYSTEM_TTL_SECONDS, request_cache
from scout_bff.overview.pipeline_reads import (
    key_role_for,
    pipeline_host,
    recent_daily_stats,
    utc_now,
)
from scout_bff.system.maintenance import maintenance_schedule
from scout_bff.system.service import (
    SYSTEM_NOTES,
    dead_by_category,
    latest_prompt_version,
    migrations_head,
    queue_summary,
)
from scout_bff.version import __version__

router = APIRouter(prefix="/app/system", tags=["system"])


async def build_system(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    settings = request.app.state.settings
    capabilities: CapabilityCache = request.app.state.capabilities
    pipeline = request.app.state.pipeline
    role = key_role_for(user.role)
    ready = await capabilities.check_ready()
    checks = capabilities.api_checks
    started_at = getattr(request.app.state, "started_at", None)
    return {
        "bff": {
            "version": __version__,
            "migrations_head": await migrations_head(request.app.state.engine),
            "started_at": started_at.isoformat() if started_at else None,
        },
        "pipeline": {
            "url_host": pipeline_host(settings.pipeline_api_url),
            "ready": ready,
            "checks": checks,
            "version": capabilities.pipeline_api_version,
            "prompt_version": await latest_prompt_version(pipeline, role=role),
        },
        "capabilities": {
            **capabilities.capabilities,
            "probe_error": capabilities.probe_error,
            "contract_version": capabilities.contract_version,
            "compatible": capabilities.compatible,
            "contract_errors": capabilities.contract_errors,
            "keys_valid": capabilities.keys_valid,
        },
        "capabilities_probed_at": (
            capabilities.probed_at.isoformat() if capabilities.probed_at else None
        ),
        "model_prices": None,
        "notes": list(SYSTEM_NOTES),
        "generated_at": utc_now().isoformat(),
    }


@router.get("")
async def get_system(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    return await request_cache(request).get_or_compute(
        "system", SYSTEM_TTL_SECONDS, lambda: build_system(request, user)
    )


@router.get("/queue")
async def get_queue(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    async def compute() -> dict[str, Any]:
        summary = await queue_summary(
            request.app.state.pipeline,
            request.app.state.capabilities,
            role=key_role_for(user.role),
        )
        return {**summary, "generated_at": utc_now().isoformat()}

    return await request_cache(request).get_or_compute(
        "system-queue", SYSTEM_TTL_SECONDS, compute
    )


@router.get("/dead-by-category")
async def get_dead_by_category(
    request: Request,
    days: int = Query(default=7, ge=1, le=90),
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    async def compute() -> dict[str, Any]:
        rows = await recent_daily_stats(
            request.app.state.pipeline, role=key_role_for(user.role), days=days
        )
        return dead_by_category(rows, utc_now().date(), days)

    return await request_cache(request).get_or_compute(
        f"system-dead-by-category:{days}", SYSTEM_TTL_SECONDS, compute
    )


@router.get("/maintenance", dependencies=[Depends(current_user)])
async def get_maintenance() -> dict[str, Any]:
    return maintenance_schedule()
