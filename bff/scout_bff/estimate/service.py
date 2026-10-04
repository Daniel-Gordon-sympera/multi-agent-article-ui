"""`GET /app/estimate` (contract §4.3): the cost to expect for one job.

With capability `cost_estimate` the question goes to `GET /v1/stats/cost-estimate`
(B2). Without it the BFF takes the last 10 completed jobs of the same kind (and
industry when given), reads their cost ledgers and answers the median and p90 of
`sum(known_cost_usd)`. Answers are cached for 60 s per (kind, sites, industry).
"""

from __future__ import annotations

import asyncio
import math
import time
from typing import Any

from scout_bff.pipeline_client import KeyRole, PipelineClient

CACHE_SECONDS = 60.0
SAMPLE_SIZE = 10
LIST_PAGE_SIZE = 200
MAX_LIST_PAGES = 3


def median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def percentile_90(values: list[float]) -> float:
    """Nearest-rank p90: the value below which 90 % of the samples fall."""
    ordered = sorted(values)
    rank = max(1, math.ceil(0.9 * len(ordered)))
    return ordered[rank - 1]


def known_cost(costs: Any) -> float | None:
    """`sum(known_cost_usd)` of the ledger rows; None when the job has no ledger."""
    if not isinstance(costs, list) or not costs:
        return None
    total = 0.0
    for row in costs:
        if isinstance(row, dict):
            total += float(row.get("known_cost_usd") or 0)
    return total


def matches(
    job: dict[str, Any], kind: str, sites: int | None, industry: str | None
) -> bool:
    if job.get("kind") != kind or job.get("status") != "completed":
        return False
    if industry:
        job_industry = (job.get("input") or {}).get("industry")
        if not isinstance(job_industry, str):
            return False
        if job_industry.strip().lower() != industry.strip().lower():
            return False
    if sites is not None:
        job_sites = (job.get("settings") or {}).get("sites")
        if job_sites is not None and job_sites != sites:
            return False
    return True


def summarise(samples: list[float], basis: str) -> dict[str, Any]:
    if not samples:
        return {"samples": 0}
    return {
        "median_cost_usd": round(median(samples), 4),
        "p90_cost_usd": round(percentile_90(samples), 4),
        "samples": len(samples),
        "basis": basis,
    }


class EstimateCache:
    def __init__(self, ttl_seconds: float = CACHE_SECONDS) -> None:
        self.ttl = ttl_seconds
        self._entries: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}

    def get(self, key: tuple[Any, ...]) -> dict[str, Any] | None:
        entry = self._entries.get(key)
        if entry and entry[0] > time.monotonic():
            return entry[1]
        self._entries.pop(key, None)
        return None

    def put(self, key: tuple[Any, ...], value: dict[str, Any]) -> None:
        self._entries[key] = (time.monotonic() + self.ttl, value)


async def estimate_from_api(
    pipeline: PipelineClient,
    role: KeyRole,
    kind: str,
    sites: int | None,
    industry: str | None,
) -> dict[str, Any]:
    body = await pipeline.get_json(
        "/v1/stats/cost-estimate", role=role, kind=kind, sites=sites, industry=industry
    )
    data = body if isinstance(body, dict) else {}
    samples = data.get("samples")
    if not isinstance(samples, int) or samples <= 0:
        return {"samples": 0}
    return {
        "median_cost_usd": float(data.get("median_cost_usd") or 0),
        "p90_cost_usd": float(
            data.get("p90_cost_usd") or data.get("median_cost_usd") or 0
        ),
        "samples": samples,
        "basis": "api",
    }


async def recent_completed_jobs(
    pipeline: PipelineClient,
    role: KeyRole,
    kind: str,
    sites: int | None,
    industry: str | None,
    *,
    industry_filter_on_api: bool,
) -> list[dict[str, Any]]:
    """Up to SAMPLE_SIZE matching completed jobs, newest first."""
    filters: dict[str, Any] = {"status": "completed", "limit": LIST_PAGE_SIZE}
    if industry and industry_filter_on_api:
        filters["industry"] = industry
    candidates: list[dict[str, Any]] = []
    async for job in pipeline.iter_items(
        "/v1/jobs", role=role, max_pages=MAX_LIST_PAGES, **filters
    ):
        if isinstance(job, dict) and matches(job, kind, sites, industry):
            candidates.append(job)
    candidates.sort(key=lambda job: str(job.get("created_at") or ""), reverse=True)
    return candidates[:SAMPLE_SIZE]


async def estimate_from_recent_jobs(
    pipeline: PipelineClient,
    role: KeyRole,
    kind: str,
    sites: int | None,
    industry: str | None,
    *,
    industry_filter_on_api: bool = False,
) -> dict[str, Any]:
    jobs = await recent_completed_jobs(
        pipeline,
        role,
        kind,
        sites,
        industry,
        industry_filter_on_api=industry_filter_on_api,
    )
    if not jobs:
        return {"samples": 0}
    details = await asyncio.gather(
        *(pipeline.get_job(str(job["id"]), role=role) for job in jobs)
    )
    samples = [cost for cost in (known_cost(d.get("costs")) for d in details) if cost]
    return summarise(samples, "recent_jobs")
