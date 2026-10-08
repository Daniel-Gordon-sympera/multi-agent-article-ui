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
    list_all_items,
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


def queue_from_counts(counts: dict[str, int]) -> dict[str, Any]:
    return {
        **{status: int(counts.get(status, 0)) for status in QUEUE_STATUSES},
        "basis": "api",
        "jobs_scanned": 0,
    }


async def queue_summary(
    pipeline: PipelineClient, capabilities: CapabilityCache, *, role: KeyRole
) -> dict[str, Any]:
    counts = {
        status: len(
            await list_all_items(pipeline, "/v1/tasks", role=role, status=status)
        )
        for status in QUEUE_STATUSES
    }
    return queue_from_counts(counts)


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
    """Read the latest job using the backend's explicit descending order."""
    try:
        page = await pipeline.list_jobs(role=role, limit=1, order="created_desc")
    except PipelineError as error:
        logger.warning("system_prompt_version_failed", error=error.category)
        return None
    rows = page.get("items", [])
    value = rows[0].get("prompt_version") if rows else None
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
