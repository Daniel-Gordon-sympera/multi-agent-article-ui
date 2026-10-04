"""Pure helpers and pipeline reads behind /app/system* (queue, dead-by-category, info)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff.capabilities import CapabilityCache
from scout_bff.db import VERSION_TABLE
from scout_bff.logging import get_logger
from scout_bff.overview.pipeline_reads import (
    NON_TERMINAL_STATUSES,
    RECENT_JOBS_FOR_FALLBACKS,
    created_at_key,
    fetch_job_details,
    iso_days_ago,
    list_all_items,
    list_jobs_by_status,
)
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

logger = get_logger("scout_bff.system")

QUEUE_STATUSES: tuple[str, ...] = ("queued", "running", "failed", "dead")
SYSTEM_NOTES: tuple[str, ...] = (
    "Model prices are not exposed by the pipeline API; costs come from "
    "GET /v1/stats/daily and the per-job cost ledger.",
    "Proxy zone and traffic volume are not exposed; the proxy state comes from the "
    "workers' proxy_ok / proxy_checked_at columns.",
    "Storage figures (snapshots, backups, disk) are not exposed by the pipeline API.",
    "Maintenance results are not exposed; the schedule is the plan's static table.",
)


def sum_queue_from_progress(details: list[dict[str, Any]]) -> dict[str, Any]:
    """Fallback without `tasks_global`: v_job_progress counters of recent jobs."""
    queued = running = dead = 0
    for detail in details:
        progress = detail.get("progress")
        if not isinstance(progress, dict):
            continue
        queued += int(progress.get("tasks_pending") or 0)
        running += int(progress.get("tasks_running") or 0)
        dead += int(progress.get("tasks_dead") or 0)
    return {
        "queued": queued,
        "running": running,
        "failed": None,
        "dead": dead,
        "basis": "recent_jobs",
        "jobs_scanned": len(details),
    }


def queue_from_counts(counts: dict[str, int]) -> dict[str, Any]:
    return {
        **{status: int(counts.get(status, 0)) for status in QUEUE_STATUSES},
        "basis": "api",
        "jobs_scanned": 0,
    }


async def queue_summary(
    pipeline: PipelineClient, capabilities: CapabilityCache, *, role: KeyRole
) -> dict[str, Any]:
    if capabilities.capabilities.get("tasks_global"):
        try:
            counts = {
                status: len(
                    await list_all_items(
                        pipeline, "/v1/tasks", role=role, status=status
                    )
                )
                for status in QUEUE_STATUSES
            }
            return queue_from_counts(counts)
        except PipelineError as error:
            logger.warning("system_queue_global_failed", error=error.category)
    jobs = await list_jobs_by_status(pipeline, NON_TERMINAL_STATUSES, role=role)
    recent = sorted(jobs, key=created_at_key, reverse=True)[:RECENT_JOBS_FOR_FALLBACKS]
    details = await fetch_job_details(
        pipeline, [str(job["id"]) for job in recent], role=role
    )
    return sum_queue_from_progress(list(details.values()))


def dead_by_category(
    rows: list[dict[str, Any]], today: date, days: int
) -> dict[str, Any]:
    """Failures of the last `days` days summed per category, largest first."""
    since = (today - timedelta(days=days - 1)).isoformat()
    totals: dict[str, int] = {}
    for row in rows:
        day = str(row.get("day") or "")[:10]
        failures = row.get("failures")
        if day < since or not isinstance(failures, dict):
            continue
        for category, count in failures.items():
            try:
                totals[str(category)] = totals.get(str(category), 0) + int(count)
            except (TypeError, ValueError):
                continue
    ordered = sorted(totals.items(), key=lambda pair: (-pair[1], pair[0]))
    largest = ordered[0][1] if ordered else 0
    items = [
        {
            "category": category,
            "count": count,
            "pct": round(count / largest * 100) if largest else 0,
        }
        for category, count in ordered
    ]
    return {"days": days, "since": since, "total": sum(totals.values()), "items": items}


async def migrations_head(engine: AsyncEngine) -> str | None:
    try:
        async with engine.connect() as connection:
            exists = await connection.scalar(
                text("SELECT to_regclass(:table)"), {"table": VERSION_TABLE}
            )
            if not exists:
                return None
            version = await connection.scalar(
                text(f"SELECT version_num FROM {VERSION_TABLE}")
            )
    except SQLAlchemyError as error:
        logger.warning("system_migrations_head_failed", error=type(error).__name__)
        return None
    return str(version) if version else None


async def latest_prompt_version(
    pipeline: PipelineClient, *, role: KeyRole
) -> str | None:
    """`prompt_version` of the most recently created job (last 30 days, else any)."""
    try:
        recent = await pipeline.list_jobs(
            role=role, limit=200, created_after=iso_days_ago(30)
        )
        rows = [row for row in recent.get("items", []) if isinstance(row, dict)]
        if not rows:
            rows = [
                row
                for row in (await pipeline.list_jobs(role=role, limit=200)).get(
                    "items", []
                )
                if isinstance(row, dict)
            ]
    except PipelineError as error:
        logger.warning("system_prompt_version_failed", error=error.category)
        return None
    if not rows:
        return None
    newest = max(rows, key=created_at_key)
    value = newest.get("prompt_version")
    return str(value) if value else None


async def pipeline_readiness(pipeline: PipelineClient) -> tuple[bool, dict[str, Any]]:
    try:
        body = await pipeline.readyz()
    except PipelineError as error:
        return False, {"error": error.category}
    checks = body.get("checks")
    return body.get("status") == "ready", dict(checks) if isinstance(
        checks, dict
    ) else {}
