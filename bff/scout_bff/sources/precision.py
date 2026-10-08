"""Observed article acceptance rates from the pipeline, including coverage."""

from __future__ import annotations

import asyncio
import statistics
from typing import Any

from scout_bff.caching import TtlCache
from scout_bff.pipeline_client import KeyRole, PipelineClient

CACHE_SECONDS = 60
MAX_CONCURRENCY = 8

_MISSING: dict[str, Any] = {"missing": True}


def _number(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    return None


def parse_precision(body: Any, domain: str) -> dict[str, Any] | None:
    """Preserve unknown denominators rather than inventing historical coverage."""
    if not isinstance(body, dict) or not isinstance(body.get("items"), list):
        return None
    item = next(
        (
            row
            for row in body["items"]
            if isinstance(row, dict) and row.get("domain") == domain
        ),
        None,
    )
    if item is None and len(body["items"]) == 1:
        # This endpoint is queried with one domain. The backend resolves a host
        # such as news.example.com to its registered domain before filtering.
        candidate = body["items"][0]
        item = candidate if isinstance(candidate, dict) else None
    if item is None:
        return None
    accepted = _number(item.get("accepted_articles"))
    if accepted is None:
        return None
    complete = item.get("complete") is True
    candidates = _number(item.get("candidates")) if complete else None
    return {
        "accepted": accepted,
        "candidates": candidates,
        "ratio": item.get("ratio") if complete else None,
        "job_id": item.get("last_job_id"),
        "at": item.get("last_job_at"),
        "basis": item.get("basis"),
        "complete": complete,
    }


async def _fetch(
    pipeline: PipelineClient, domain: str, role: KeyRole
) -> dict[str, Any]:
    body = await pipeline.get_json("/v1/sources/stats", role=role, domain=domain)
    return parse_precision(body, domain) or _MISSING


async def precision_by_domain(
    pipeline: PipelineClient, domains: list[str], role: KeyRole
) -> dict[str, dict[str, Any] | None]:
    """One stats call per distinct domain (bounded, cached 60 s)."""
    cache = getattr(pipeline, "source_stats_cache", None)
    if cache is None:
        cache = TtlCache(CACHE_SECONDS)
        pipeline.source_stats_cache = cache
    distinct = list(dict.fromkeys(domains))
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def load(domain: str) -> dict[str, Any]:
        async with semaphore:
            return await cache.get_or_load(
                domain, lambda: _fetch(pipeline, domain, role)
            )

    results = await asyncio.gather(*(load(domain) for domain in distinct))
    return {
        domain: (None if result is _MISSING else result)
        for domain, result in zip(distinct, results, strict=True)
    }


def median_ratio(values: list[dict[str, Any] | None]) -> float | None:
    ratios = [
        float(value["ratio"])
        for value in values
        if value and isinstance(value.get("ratio"), (int, float))
    ]
    return statistics.median(ratios) if ratios else None
