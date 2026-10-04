"""GET /app/overview (tiles, 10 s cache) and GET /app/overview/active-runs (5 s cache)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.capabilities import CapabilityCache
from scout_bff.logging import get_logger
from scout_bff.overview.cache import (
    ACTIVE_RUNS_TTL_SECONDS,
    OVERVIEW_TTL_SECONDS,
    request_cache,
)
from scout_bff.overview.pipeline_reads import (
    NON_TERMINAL_STATUSES,
    fetch_job_details,
    fetch_job_resources,
    key_role_for,
    list_all_items,
    list_jobs_by_status,
    recent_daily_stats,
    utc_now,
)
from scout_bff.overview.summary import (
    cost_summary,
    dead_tasks_from_failures,
    dead_tasks_from_tasks,
    job_cost,
    running_jobs_summary,
    signals_summary,
    sites_summary,
)
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

router = APIRouter(prefix="/app/overview", tags=["overview"])
logger = get_logger("scout_bff.overview")

ACTIVE_RUNS_LIMIT = 25
STATS_DAYS = 15


async def count_distinct_scouts(engine: AsyncEngine, job_ids: list[str]) -> int:
    """Distinct Scouts behind the given jobs (ui.batch_jobs ⋈ ui.batches)."""
    if not job_ids:
        return 0
    try:
        async with engine.connect() as connection:
            value = await connection.scalar(
                text(
                    "SELECT count(DISTINCT b.scout_id) FROM ui.batch_jobs bj "
                    "JOIN ui.batches b ON b.id = bj.batch_id "
                    "WHERE b.scout_id IS NOT NULL "
                    "AND bj.job_id = ANY(CAST(:ids AS uuid[]))"
                ),
                {"ids": job_ids},
            )
    except SQLAlchemyError as error:
        logger.warning("overview_scouts_count_failed", error=type(error).__name__)
        return 0
    return int(value or 0)


async def dead_tasks_section(
    pipeline: PipelineClient,
    capabilities: CapabilityCache,
    daily_rows: list[dict[str, Any]],
    *,
    role: KeyRole,
) -> dict[str, Any]:
    now = utc_now()
    if capabilities.capabilities.get("tasks_global"):
        try:
            tasks = await list_all_items(
                pipeline, "/v1/tasks", role=role, status="dead"
            )
            return dead_tasks_from_tasks(tasks, now)
        except PipelineError as error:
            logger.warning("overview_global_tasks_failed", error=error.category)
    return dead_tasks_from_failures(daily_rows, now.date())


async def build_overview(request: Request, user: AuthenticatedUser) -> dict[str, Any]:
    pipeline: PipelineClient = request.app.state.pipeline
    capabilities: CapabilityCache = request.app.state.capabilities
    role = key_role_for(user.role)
    jobs = await list_jobs_by_status(pipeline, NON_TERMINAL_STATUSES, role=role)
    daily_rows = await recent_daily_stats(pipeline, role=role, days=STATS_DAYS)
    scouts = await count_distinct_scouts(
        request.app.state.engine, [str(job["id"]) for job in jobs]
    )
    today = utc_now().date()
    return {
        "running_jobs": running_jobs_summary(jobs, scouts),
        "signals_7d": signals_summary(daily_rows, today),
        "cost_today": cost_summary(daily_rows, today),
        "dead_tasks": await dead_tasks_section(
            pipeline, capabilities, daily_rows, role=role
        ),
        "generated_at": utc_now().isoformat(),
    }


@router.get("")
async def get_overview(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    return await request_cache(request).get_or_compute(
        "overview", OVERVIEW_TTL_SECONDS, lambda: build_overview(request, user)
    )


def has_seeds(detail: dict[str, Any] | None) -> bool:
    progress = detail.get("progress") if detail else None
    return bool(isinstance(progress, dict) and progress.get("seeds"))


def active_run_row(
    job: dict[str, Any],
    detail: dict[str, Any] | None,
    site_runs: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    row = {key: value for key, value in job.items() if key not in {"progress", "costs"}}
    if detail is None:
        row.update(progress=None, cost_usd=None, cost_complete=False, sites=None)
        return row
    cost, complete = job_cost(detail)
    row.update(
        status=detail.get("status", job.get("status")),
        stop_reason=detail.get("stop_reason", job.get("stop_reason")),
        progress=detail.get("progress"),
        cost_usd=cost,
        cost_complete=complete,
        sites=sites_summary(detail, site_runs),
    )
    return row


async def build_active_runs(
    request: Request, user: AuthenticatedUser
) -> dict[str, Any]:
    pipeline: PipelineClient = request.app.state.pipeline
    role = key_role_for(user.role)
    jobs = (await list_jobs_by_status(pipeline, NON_TERMINAL_STATUSES, role=role))[
        :ACTIVE_RUNS_LIMIT
    ]
    ids = [str(job["id"]) for job in jobs]
    details = await fetch_job_details(pipeline, ids, role=role)
    with_seeds = [job_id for job_id in ids if has_seeds(details.get(job_id))]
    site_runs = await fetch_job_resources(pipeline, with_seeds, "site-runs", role=role)
    items = [
        active_run_row(job, details.get(str(job["id"])), site_runs.get(str(job["id"])))
        for job in jobs
    ]
    return {"items": items, "generated_at": utc_now().isoformat()}


@router.get("/active-runs")
async def get_active_runs(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    return await request_cache(request).get_or_compute(
        "active-runs", ACTIVE_RUNS_TTL_SECONDS, lambda: build_active_runs(request, user)
    )
