"""Per-domain precision from `GET /v1/sources/stats?domain=` (capability `sources_stats`,
pipeline PR B2). Without the capability every `precision` is null and so is the median."""

from __future__ import annotations

import asyncio
import statistics
from typing import Any

from scout_bff.caching import TtlCache
from scout_bff.logging import get_logger
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

logger = get_logger("scout_bff.sources.precision")
CACHE_SECONDS = 60
MAX_CONCURRENCY = 8
MAX_DOMAINS = 200

precision_cache: TtlCache[dict[str, Any]] = TtlCache(CACHE_SECONDS)
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
    """Tolerates `{items: [...]}` pages and single objects; None when nothing usable."""
    item: Any = body
    if isinstance(body, dict) and isinstance(body.get("items"), list):
        rows = [row for row in body["items"] if isinstance(row, dict)]
        item = next((row for row in rows if row.get("domain") == domain), None)
        if item is None and rows:
            item = rows[0]
    if not isinstance(item, dict):
        return None
    accepted = _number(item.get("accepted", item.get("accepted_articles")))
    candidates = _number(item.get("candidates"))
    if accepted is None or candidates is None:
        return None
    return {
        "accepted": accepted,
        "candidates": candidates,
        "ratio": (accepted / candidates) if candidates > 0 else None,
        "job_id": item.get("job_id") or item.get("last_job_id"),
        "at": item.get("at") or item.get("last_job_at") or item.get("as_of"),
    }


async def _fetch(
    pipeline: PipelineClient, domain: str, role: KeyRole
) -> dict[str, Any]:
    try:
        body = await pipeline.get_json("/v1/sources/stats", role=role, domain=domain)
    except PipelineError as error:
        if error.status not in (404, 410):
            logger.warning("sources_stats_failed", domain=domain, status=error.status)
        return _MISSING
    return parse_precision(body, domain) or _MISSING


async def precision_by_domain(
    pipeline: PipelineClient, domains: list[str], role: KeyRole
) -> dict[str, dict[str, Any] | None]:
    """One stats call per distinct domain (bounded, cached 60 s)."""
    distinct = list(dict.fromkeys(domains))[:MAX_DOMAINS]
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    async def load(domain: str) -> dict[str, Any]:
        async with semaphore:
            return await precision_cache.get_or_load(
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
