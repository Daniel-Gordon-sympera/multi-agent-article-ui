"""Run facts joined onto Scouts: the last batch's job statuses and signal counts
(`GET /v1/jobs/{id}`, 5 s cache) and the jobs of the last 10 batches."""

from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.batches import repository as batches
from scout_bff.caching import TtlCache
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError
from scout_bff.scouts.repository import scout_json

LAST_RUN_CACHE_SECONDS = 5
JOBS_BATCHES = 10
_MISSING: dict[str, Any] = {"missing": True}

job_cache: TtlCache[dict[str, Any]] = TtlCache(LAST_RUN_CACHE_SECONDS, max_entries=2048)


async def fetch_job(
    pipeline: PipelineClient, job_id: str, role: KeyRole
) -> dict[str, Any] | None:
    """The job row or None when the API has no such job (404) or failed for it."""

    async def load() -> dict[str, Any]:
        try:
            return await pipeline.get_job(job_id, role=role)
        except PipelineError:
            return _MISSING

    result = await job_cache.get_or_load(job_id, load)
    return None if result is _MISSING else result


async def fetch_jobs(
    pipeline: PipelineClient, job_ids: list[str], role: KeyRole
) -> dict[str, dict[str, Any] | None]:
    distinct = list(dict.fromkeys(job_ids))
    rows = await asyncio.gather(
        *(fetch_job(pipeline, job_id, role) for job_id in distinct)
    )
    return dict(zip(distinct, rows, strict=True))


def job_signals(job: dict[str, Any] | None) -> int | None:
    if not job:
        return None
    progress = job.get("progress") or {}
    value = progress.get("signals")
    if value is None:
        summary = job.get("summary") or {}
        value = summary.get("signals") if isinstance(summary, dict) else None
    return int(value) if isinstance(value, (int, float)) else None


def last_run_json(
    facts: dict[str, Any], jobs: dict[str, dict[str, Any] | None]
) -> dict[str, Any]:
    legs = [
        {
            "job_id": str(leg["job_id"]),
            "industry": leg.get("industry"),
            "status": (jobs.get(str(leg["job_id"])) or {}).get("status"),
            "signals": job_signals(jobs.get(str(leg["job_id"]))),
        }
        for leg in facts["legs"]
        if leg.get("job_id")
    ]
    return {
        "batch_id": facts["batch_id"],
        "run_number": facts["run_number"],
        "created_at": facts["created_at"],
        "jobs": legs,
    }


def signals_total(last_run: dict[str, Any] | None) -> int | None:
    if not last_run:
        return None
    counts = [job["signals"] for job in last_run["jobs"] if job["signals"] is not None]
    return sum(counts) if counts else None


async def scouts_with_runs(
    connection: AsyncConnection,
    pipeline: PipelineClient,
    scout_rows: list[dict[str, Any]],
    role: KeyRole,
) -> list[dict[str, Any]]:
    """`ScoutWithRuns[]`: one `GET /v1/jobs/{id}` per job of each scout's last batch."""
    facts_by_scout = await batches.last_batches_by_scout(connection)
    job_ids = [
        str(leg["job_id"])
        for facts in facts_by_scout.values()
        for leg in facts["legs"]
        if leg.get("job_id")
    ]
    jobs = await fetch_jobs(pipeline, job_ids, role)
    items = []
    for row in scout_rows:
        facts = facts_by_scout.get(str(row["id"]))
        last_run = last_run_json(facts, jobs) if facts else None
        items.append(
            {
                **scout_json(row),
                "runs_count": facts["runs_count"] if facts else 0,
                "last_run": last_run,
                "signals_last_run": signals_total(last_run),
            }
        )
    return items


async def scout_jobs(
    connection: AsyncConnection,
    pipeline: PipelineClient,
    scout_id: Any,
    role: KeyRole,
) -> list[dict[str, Any]]:
    """Job rows of the scout's last 10 batches, newest batch first, legs in position order."""
    recent = await batches.scout_batches(connection, scout_id, limit=JOBS_BATCHES)
    job_ids = [
        str(leg["job_id"])
        for batch in recent
        for leg in batch["legs"]
        if leg.get("job_id")
    ]
    jobs = await fetch_jobs(pipeline, job_ids, role)
    return [jobs[job_id] for job_id in job_ids if jobs.get(job_id)]
