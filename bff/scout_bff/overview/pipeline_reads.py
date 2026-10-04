"""Bounded pipeline reads shared by the B4 aggregates (overview, attention, system).

Everything here is a GET against `/v1` through `PipelineClient`, keyed by the caller's
role (admin/operator → operator key, viewer → reader key) and bounded in the number of
rows and parallel calls so a busy dashboard never fans out further than documented.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Iterable
from datetime import datetime, timedelta, timezone
from typing import Any, TypeVar
from urllib.parse import urlparse

from scout_bff.auth.roles import role_satisfies
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

T = TypeVar("T")

RUNNING_TILE_STATUSES: tuple[str, ...] = (
    "queued",
    "finding",
    "exploring",
    "discovering",
    "analysing",
    "finalizing",
)
NON_TERMINAL_STATUSES: tuple[str, ...] = (*RUNNING_TILE_STATUSES, "cancelling")
TERMINAL_STATUSES: tuple[str, ...] = ("completed", "partial", "failed", "cancelled")
SITE_RUN_DONE_STATUSES = frozenset(
    {"finished", "no_sections", "partial", "failed", "cancelled"}
)
MAX_PARALLEL_CALLS = 8
MAX_LIST_ROWS = 200
RECENT_JOBS_FOR_FALLBACKS = 20


def key_role_for(role: str) -> KeyRole:
    """UI role → the pipeline key the BFF uses for its own reads."""
    return "operator" if role_satisfies(role, "operator") else "viewer"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_days_ago(days: int, now: datetime | None = None) -> str:
    return ((now or utc_now()) - timedelta(days=days)).isoformat()


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def created_at_key(job: dict[str, Any]) -> str:
    return str(job.get("created_at") or "")


def pipeline_host(pipeline_api_url: str) -> str:
    parsed = urlparse(pipeline_api_url)
    return parsed.netloc or pipeline_api_url


async def gather_limited(
    awaitables: Iterable[Awaitable[T]], limit: int = MAX_PARALLEL_CALLS
) -> list[T | BaseException]:
    """`asyncio.gather(return_exceptions=True)` behind a semaphore."""
    semaphore = asyncio.Semaphore(limit)

    async def run(awaitable: Awaitable[T]) -> T:
        async with semaphore:
            return await awaitable

    return list(
        await asyncio.gather(
            *(run(item) for item in awaitables), return_exceptions=True
        )
    )


def successful(results: Iterable[T | BaseException]) -> list[T]:
    """Keep the values; re-raise anything that is not a pipeline problem."""
    kept: list[T] = []
    for result in results:
        if isinstance(result, PipelineError):
            continue
        if isinstance(result, BaseException):
            raise result
        kept.append(result)
    return kept


async def list_jobs_by_status(
    pipeline: PipelineClient,
    statuses: Iterable[str],
    *,
    role: KeyRole,
    created_after: str | None = None,
    limit: int = MAX_LIST_ROWS,
) -> list[dict[str, Any]]:
    """One `GET /v1/jobs?status=` per status (exact-match filters), newest first."""
    pages = await gather_limited(
        pipeline.list_jobs(
            role=role, status=status, limit=limit, created_after=created_after
        )
        for status in statuses
    )
    rows: dict[str, dict[str, Any]] = {}
    for page in successful(pages):
        for item in page.get("items", []):
            if isinstance(item, dict) and item.get("id"):
                rows[str(item["id"])] = item
    return sorted(rows.values(), key=created_at_key, reverse=True)


async def list_non_terminal_jobs(
    pipeline: PipelineClient, *, role: KeyRole
) -> list[dict[str, Any]]:
    return await list_jobs_by_status(pipeline, NON_TERMINAL_STATUSES, role=role)


async def fetch_job_details(
    pipeline: PipelineClient, job_ids: Iterable[str], *, role: KeyRole
) -> dict[str, dict[str, Any]]:
    """Parallel `GET /v1/jobs/{id}`; jobs that vanished (404) are skipped."""
    ids = list(dict.fromkeys(job_ids))
    results = await gather_limited(
        pipeline.get_job(job_id, role=role) for job_id in ids
    )
    details: dict[str, dict[str, Any]] = {}
    for job_id, result in zip(ids, results, strict=True):
        if isinstance(result, dict):
            details[job_id] = result
        elif isinstance(result, BaseException) and not isinstance(
            result, PipelineError
        ):
            raise result
    return details


async def fetch_job_resources(
    pipeline: PipelineClient,
    job_ids: Iterable[str],
    resource: str,
    *,
    role: KeyRole,
    **filters: Any,
) -> dict[str, list[dict[str, Any]]]:
    """Parallel `GET /v1/jobs/{id}/{resource}` (first page, ≤ 200 rows each)."""
    ids = list(dict.fromkeys(job_ids))
    results = await gather_limited(
        pipeline.list_job_resource(
            job_id, resource, role=role, limit=MAX_LIST_ROWS, **filters
        )
        for job_id in ids
    )
    rows: dict[str, list[dict[str, Any]]] = {}
    for job_id, result in zip(ids, results, strict=True):
        if isinstance(result, dict):
            rows[job_id] = [
                item for item in result.get("items", []) if isinstance(item, dict)
            ]
        elif isinstance(result, BaseException) and not isinstance(
            result, PipelineError
        ):
            raise result
    return rows


async def list_all_items(
    pipeline: PipelineClient,
    path: str,
    *,
    role: KeyRole,
    max_pages: int = 5,
    **filters: Any,
) -> list[dict[str, Any]]:
    """Walk a keyset list (bounded pages of 1000 rows) and return the rows."""
    return [
        item
        async for item in pipeline.iter_items(
            path, role=role, max_pages=max_pages, limit=1000, **filters
        )
    ]


async def recent_daily_stats(
    pipeline: PipelineClient, *, role: KeyRole, days: int
) -> list[dict[str, Any]]:
    """`GET /v1/stats/daily` for the last `days` days (one page, ≤ 200 rows)."""
    created_after = (utc_now().date() - timedelta(days=days + 1)).isoformat()
    page = await pipeline.daily_stats(
        role=role, created_after=created_after, limit=MAX_LIST_ROWS
    )
    return [row for row in page.get("items", []) if isinstance(row, dict)]


def job_label(job: dict[str, Any]) -> str:
    """ "Orange County, FL · Construction" — the wording of `features/jobs/jobTitle.ts`."""
    county = str(job.get("county") or "").strip()
    state = str(job.get("state_code") or "").strip().upper()
    county_part = (
        (county if county.lower().endswith("county") else f"{county} County")
        if county
        else ""
    )
    location = ", ".join(part for part in (county_part, state) if part) or "—"
    return f"{location} · {job_target(job)}"


def job_target(job: dict[str, Any]) -> str:
    job_input = job.get("input") if isinstance(job.get("input"), dict) else {}
    industry = job_input.get("industry")
    if isinstance(industry, str) and industry.strip():
        return industry
    kind = str(job.get("kind") or "")
    if kind == "url" and isinstance(job_input.get("url"), str):
        host = urlparse(job_input["url"]).hostname or job_input["url"]
        return host.removeprefix("www.")
    if kind == "seeds":
        seeds = job_input.get("seeds")
        count = len(seeds) if isinstance(seeds, list) else 0
        return "1 seed" if count == 1 else f"{count} seeds"
    return kind or "job"
