"""`GET /app/jobs/progress`: one snapshot per job for the Runs table.

The list endpoint returns `JobRecord` rows without progress or costs, so the table
asks the BFF for `{job_id: {status, progress, cost_usd, sites_total, sites_done,
duration_seconds}}`. Each snapshot is one `GET /v1/jobs/{id}` plus one page of
`/site-runs`, fetched in parallel and cached for a few seconds.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from scout_bff.errors import Problem
from scout_bff.logging import get_logger
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

logger = get_logger("scout_bff.jobs.progress")

MAX_JOB_IDS = 50
CACHE_SECONDS = 5.0
SITE_RUN_PAGE_SIZE = 1000
DONE_SITE_RUN_STATUSES = frozenset(
    {"finished", "partial", "failed", "no_sections", "cancelled"}
)


def parse_job_ids(raw: str) -> list[str]:
    """`a,b,c` → distinct ids in order; more than MAX_JOB_IDS is a 422."""
    ids: list[str] = []
    for part in raw.split(","):
        value = part.strip()
        if value and value not in ids:
            ids.append(value)
    if len(ids) > MAX_JOB_IDS:
        raise Problem(
            422,
            "too_many_job_ids",
            f"At most {MAX_JOB_IDS} job ids per call ({len(ids)} given).",
        )
    return ids


def total_cost_usd(costs: Any) -> float | None:
    """Sum of the ledger rows: the complete cost when priced, else the known part."""
    if not isinstance(costs, list) or not costs:
        return None
    total = 0.0
    for row in costs:
        if not isinstance(row, dict):
            continue
        value = row.get("cost_usd")
        if value is None:
            value = row.get("known_cost_usd") or 0
        total += float(value)
    return round(total, 4)


def site_counts(site_runs: list[dict[str, Any]]) -> tuple[int, int]:
    done = sum(1 for run in site_runs if run.get("status") in DONE_SITE_RUN_STATUSES)
    return done, len(site_runs)


def _parse(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def duration_seconds(job: dict[str, Any], now: datetime) -> float | None:
    started = _parse(job.get("started_at"))
    if started is None:
        return None
    finished = _parse(job.get("finished_at")) or now
    return max(0.0, round((finished - started).total_seconds(), 1))


def snapshot(
    job: dict[str, Any], site_runs: list[dict[str, Any]], now: datetime
) -> dict[str, Any]:
    done, total = site_counts(site_runs)
    progress = job.get("progress")
    return {
        "status": job.get("status"),
        "progress": progress if isinstance(progress, dict) else None,
        "cost_usd": total_cost_usd(job.get("costs")),
        "sites_total": total,
        "sites_done": done,
        "duration_seconds": duration_seconds(job, now),
    }


class ProgressCache:
    """Snapshots keyed by job id with a short expiry (contract: 5 s)."""

    def __init__(self, ttl_seconds: float = CACHE_SECONDS) -> None:
        self.ttl = ttl_seconds
        self._entries: dict[str, tuple[float, dict[str, Any]]] = {}

    def get(self, job_id: str, at: float | None = None) -> dict[str, Any] | None:
        entry = self._entries.get(job_id)
        if entry is None:
            return None
        expires, value = entry
        if (at if at is not None else time.monotonic()) >= expires:
            del self._entries[job_id]
            return None
        return value

    def put(self, job_id: str, value: dict[str, Any], at: float | None = None) -> None:
        now = at if at is not None else time.monotonic()
        self._entries[job_id] = (now + self.ttl, value)
        if len(self._entries) > 4 * MAX_JOB_IDS:
            self._entries = {
                key: entry for key, entry in self._entries.items() if entry[0] > now
            }


async def fetch_snapshot(
    pipeline: PipelineClient, job_id: str, role: KeyRole, now: datetime
) -> dict[str, Any] | None:
    """The job and its site runs in parallel; an unknown job yields None."""
    try:
        job, runs = await asyncio.gather(
            pipeline.get_job(job_id, role=role),
            pipeline.list_job_resource(
                job_id, "site-runs", role=role, limit=SITE_RUN_PAGE_SIZE
            ),
        )
    except PipelineError as error:
        if error.status == 404:
            return None
        raise
    items = runs.get("items") if isinstance(runs, dict) else None
    return snapshot(job, items if isinstance(items, list) else [], now)


async def collect_progress(
    pipeline: PipelineClient,
    cache: ProgressCache,
    job_ids: list[str],
    role: KeyRole,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Cached snapshots first; the rest is fetched concurrently.

    One unreachable job does not fail the others: a 404 is skipped silently, any
    other upstream problem is logged and skipped unless every job failed.
    """
    now = now or datetime.now(timezone.utc)
    result: dict[str, Any] = {}
    missing: list[str] = []
    for job_id in job_ids:
        cached = cache.get(job_id)
        if cached is not None:
            result[job_id] = cached
        else:
            missing.append(job_id)
    if not missing:
        return result
    outcomes = await asyncio.gather(
        *(fetch_snapshot(pipeline, job_id, role, now) for job_id in missing),
        return_exceptions=True,
    )
    failures: list[PipelineError] = []
    for job_id, outcome in zip(missing, outcomes, strict=True):
        if isinstance(outcome, PipelineError):
            failures.append(outcome)
            logger.warning("job_progress_failed", job_id=job_id, error=str(outcome))
            continue
        if isinstance(outcome, BaseException):
            raise outcome
        if outcome is None:
            continue
        cache.put(job_id, outcome)
        result[job_id] = outcome
    if failures and len(failures) == len(missing) and not result:
        raise failures[0]
    return result
