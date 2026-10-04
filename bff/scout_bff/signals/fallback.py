"""The bounded fallback of contract §4.4 while `GET /v1/signals` (B1) is missing.

Pick the 20 most recent jobs matching the job filters, fetch each job's `/signals`
with the pass-through filters, merge and decorate the rows, keep the merged list for
30 seconds per normalised query. Row filters, sorting and paging happen in `rows.py`.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError
from scout_bff.signals.query import SignalsQuery
from scout_bff.signals.rows import decorate_row, job_matches, sort_rows

MAX_JOBS = 20
JOB_PAGE_SIZE = 200
MAX_JOB_PAGES = 5
MAX_ROWS_PER_JOB = 1000
CACHE_SECONDS = 30.0
CONCURRENT_JOB_FETCHES = 5


@dataclass
class MergedSignals:
    """The cached merge of one normalised query (already sorted)."""

    rows: list[dict[str, Any]]
    scanned_jobs: int
    truncated: bool
    expires_at: float = field(default=0.0)


class SignalsCache:
    """Per-process TTL cache keyed by the normalised query (contract: 30 s)."""

    def __init__(self, ttl_seconds: float = CACHE_SECONDS) -> None:
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, MergedSignals] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def get(self, key: str, now: float | None = None) -> MergedSignals | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= (now if now is not None else time.monotonic()):
            self._entries.pop(key, None)
            return None
        return entry

    def put(self, key: str, merged: MergedSignals, now: float | None = None) -> None:
        merged.expires_at = (now if now is not None else time.monotonic()) + (
            self.ttl_seconds
        )
        self._entries[key] = merged
        if len(self._entries) > 256:
            oldest = sorted(self._entries, key=lambda k: self._entries[k].expires_at)
            for stale in oldest[: len(self._entries) - 256]:
                self._entries.pop(stale, None)

    def lock(self, key: str) -> asyncio.Lock:
        return self._locks.setdefault(key, asyncio.Lock())

    def clear(self) -> None:
        self._entries.clear()


def _created_at(job: dict[str, Any]) -> str:
    return str(job.get("created_at") or "")


def _newest_first(jobs: list[dict[str, Any]]) -> bool:
    stamps = [_created_at(job) for job in jobs]
    return all(a >= b for a, b in zip(stamps, stamps[1:]))


async def batch_job_ids(engine: AsyncEngine, batch_id: str) -> list[str]:
    """Job ids of a UI batch (`ui.batch_jobs`); legs the API rejected have none."""
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                "SELECT job_id FROM ui.batch_jobs "
                "WHERE batch_id = CAST(:batch_id AS uuid) AND job_id IS NOT NULL "
                "ORDER BY position"
            ),
            {"batch_id": batch_id},
        )
        return [str(row[0]) for row in result.all()]


async def _fetch_jobs_by_id(
    pipeline: PipelineClient, role: KeyRole, job_ids: list[str]
) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for job_id in job_ids[:MAX_JOBS]:
        try:
            jobs.append(await pipeline.get_job(job_id, role=role))
        except PipelineError as error:
            if error.status == 404:
                continue
            raise
    return jobs


async def _scan_recent_jobs(
    pipeline: PipelineClient, role: KeyRole, job_filters: dict[str, str]
) -> list[dict[str, Any]]:
    """Walk `GET /v1/jobs` (bounded) and keep the matching jobs, newest first."""
    api_filters = {
        name: job_filters[name] for name in ("state", "county") if name in job_filters
    }
    matches: list[dict[str, Any]] = []
    after: str | None = None
    ordered = True
    for _ in range(MAX_JOB_PAGES):
        page = await pipeline.list_jobs(
            role=role, limit=JOB_PAGE_SIZE, after=after, **api_filters
        )
        items = [item for item in page.get("items", []) if isinstance(item, dict)]
        ordered = ordered and _newest_first(items)
        matches.extend(item for item in items if job_matches(item, job_filters))
        after = page.get("next_cursor")
        if not after or (ordered and len(matches) >= MAX_JOBS):
            break
    matches.sort(key=_created_at, reverse=True)
    return matches[:MAX_JOBS]


async def select_jobs(
    pipeline: PipelineClient,
    engine: AsyncEngine,
    role: KeyRole,
    job_filters: dict[str, str],
) -> list[dict[str, Any]]:
    """The jobs whose signals the fallback merges (at most MAX_JOBS, newest first)."""
    if "job_id" in job_filters:
        jobs = await _fetch_jobs_by_id(pipeline, role, [job_filters["job_id"]])
    elif "batch_id" in job_filters:
        ids = await batch_job_ids(engine, job_filters["batch_id"])
        jobs = await _fetch_jobs_by_id(pipeline, role, ids)
    else:
        return await _scan_recent_jobs(pipeline, role, job_filters)
    jobs = [job for job in jobs if job_matches(job, job_filters)]
    jobs.sort(key=_created_at, reverse=True)
    return jobs[:MAX_JOBS]


async def _job_signals(
    pipeline: PipelineClient,
    role: KeyRole,
    job: dict[str, Any],
    pass_through: dict[str, str],
    semaphore: asyncio.Semaphore,
) -> tuple[list[dict[str, Any]], bool]:
    async with semaphore:
        page = await pipeline.list_job_signals(
            str(job["id"]), role=role, limit=MAX_ROWS_PER_JOB, **pass_through
        )
    rows = [
        decorate_row(row, job) for row in page.get("items", []) if isinstance(row, dict)
    ]
    return rows, bool(page.get("next_cursor"))


async def merge_signals(
    pipeline: PipelineClient,
    engine: AsyncEngine,
    role: KeyRole,
    query: SignalsQuery,
) -> MergedSignals:
    """Fetch and merge without the cache (the cache wraps this)."""
    jobs = await select_jobs(pipeline, engine, role, query.job_filters)
    semaphore = asyncio.Semaphore(CONCURRENT_JOB_FETCHES)
    results = await asyncio.gather(
        *(
            _job_signals(pipeline, role, job, query.pass_through, semaphore)
            for job in jobs
        )
    )
    rows: list[dict[str, Any]] = []
    truncated = False
    for job_rows, job_truncated in results:
        rows.extend(job_rows)
        truncated = truncated or job_truncated
    return MergedSignals(
        rows=sort_rows(rows), scanned_jobs=len(jobs), truncated=truncated
    )


async def cached_merge(
    cache: SignalsCache,
    pipeline: PipelineClient,
    engine: AsyncEngine,
    role: KeyRole,
    query: SignalsQuery,
) -> MergedSignals:
    """The merged list for this query, fetched at most once per TTL window."""
    key = query.cache_key
    cached = cache.get(key)
    if cached is not None:
        return cached
    async with cache.lock(key):
        cached = cache.get(key)
        if cached is not None:
            return cached
        merged = await merge_signals(pipeline, engine, role, query)
        cache.put(key, merged)
        return merged
