"""Finder suggestions: judged-domain memory ("keep") + rankings of recent jobs
(contract §4.3 `GET /app/sources/suggestions`), merged and de-duplicated by domain."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.caching import TtlCache
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError
from scout_bff.sources import repository as sources
from scout_bff.sources.domains import InvalidUrl, domain_of
from scout_bff.sources.states import normalise_county, normalise_state_code, state_name

CACHE_SECONDS = 60
RANKING_JOBS = 5
MAX_LOCATIONS = 10
DEFAULT_LIMIT = 50
MAX_LIMIT = 200
_SMALL_WORDS = {"and", "of", "the"}

candidate_cache: TtlCache[list[dict[str, Any]]] = TtlCache(CACHE_SECONDS)


@dataclass(frozen=True)
class SuggestionQuery:
    county: str | None
    state: str | None
    industry: str | None
    limit: int = DEFAULT_LIMIT

    @property
    def cache_key(self) -> tuple[str | None, str | None, str | None]:
        return (
            self.county.casefold() if self.county else None,
            self.state,
            self.industry.casefold() if self.industry else None,
        )


def location_keys(county: str, state_code: str) -> list[str]:
    """Both spellings the finder may have stored: "Orange County, Florida" and "Orange, FL"."""
    county = normalise_county(county)
    return [f"{county} County, {state_name(state_code)}", f"{county}, {state_code}"]


def industry_label(value: str | None) -> str | None:
    if not value:
        return None
    words = value.replace("_", " ").split()
    return " ".join(
        w if (i and w.lower() in _SMALL_WORDS) else w[:1].upper() + w[1:]
        for i, w in enumerate(words)
    )


def ordinal(number: int) -> str:
    if 10 <= number % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    return f"{number}{suffix}"


def _domain(url: str | None, fallback: str | None) -> str | None:
    for candidate in (url, fallback):
        if candidate:
            try:
                return domain_of(candidate)
            except InvalidUrl:
                continue
    return None


def suggestion_from_memory(
    row: dict[str, Any], county: str, state_code: str
) -> dict[str, Any] | None:
    domain = _domain(row.get("url"), row.get("domain"))
    if not domain:
        return None
    tier = row.get("tier")
    return {
        "domain": domain,
        "name": row.get("name") or None,
        "url": row.get("url") or f"https://{domain}",
        "tier": str(tier) if tier is not None else None,
        "verdict": row.get("verdict") or "keep",
        "reason": row.get("reason") or "Kept by the finder's judged-domain memory",
        "judged_at": row.get("judged_at"),
        "rank": None,
        "job_id": row.get("job_id"),
        "county": normalise_county(county),
        "state_code": state_code,
        "industry": industry_label(row.get("industry_key")),
        "origin": "finder_memory",
    }


def suggestion_from_ranking(row: dict[str, Any], job: dict[str, Any]) -> dict | None:
    domain = _domain(row.get("url"), row.get("name"))
    if not domain:
        return None
    rank = row.get("overall_rank")
    base = row.get("finder_reason") or row.get("reason") or "Ranked by the finder"
    details = ", ".join(
        f"{label}: {row[key]}"
        for key, label in (("coverage", "coverage"), ("relevance", "relevance"))
        if row.get(key)
    )
    reason = f"{base} ({details})" if details and "(" not in base else base
    if isinstance(rank, int):
        reason = f"{reason}; ranked {ordinal(rank)}"
    if row.get("chosen"):
        reason = f"{reason}, explored in this job"
    tier = row.get("tier")
    return {
        "domain": domain,
        "name": row.get("name") or None,
        "url": row.get("url") or f"https://{domain}",
        "tier": str(tier) if tier is not None else None,
        "verdict": "keep",
        "reason": reason,
        "judged_at": job.get("created_at"),
        "rank": rank if isinstance(rank, int) else None,
        "job_id": job.get("id"),
        "county": normalise_county(str(job.get("county") or "")),
        "state_code": normalise_state_code(str(job.get("state_code") or "")) or "",
        "industry": (job.get("input") or {}).get("industry"),
        "origin": "ranking",
    }


def suggestion_key(item: dict[str, Any]) -> tuple[str, str, str]:
    return (item["domain"], item["county"].casefold(), item["state_code"])


def merge_suggestions(
    candidates: list[dict[str, Any]],
    *,
    listed: set[tuple[str, str, str]],
    dismissed: set[tuple[str, str, str]],
    industry: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    """Pure: keep the first candidate per (domain, county, state); drop listed and dismissed
    domains; optional industry filter; bounded by `limit`."""
    wanted = industry.casefold() if industry else None
    seen: set[tuple[str, str, str]] = set()
    result: list[dict[str, Any]] = []
    for item in candidates:
        key = suggestion_key(item)
        if key in seen or key in listed or key in dismissed:
            continue
        if wanted and (item.get("industry") or "").casefold() != wanted:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result


async def _recent_jobs(
    pipeline: PipelineClient, query: SuggestionQuery, role: KeyRole
) -> list[dict[str, Any]]:
    filters: dict[str, Any] = {"limit": 200}
    if query.county:
        filters["county"] = normalise_county(query.county)
    if query.state:
        filters["state"] = query.state
    jobs = [
        job
        async for job in pipeline.iter_items(
            "/v1/jobs", role=role, max_pages=2, **filters
        )
    ]
    jobs = [job for job in jobs if job.get("kind") == "location_industry"]
    jobs.sort(key=lambda job: str(job.get("created_at") or ""), reverse=True)
    return jobs


async def _memory_rows(
    pipeline: PipelineClient, key: str, role: KeyRole
) -> list[dict[str, Any]]:
    try:
        return [
            row
            async for row in pipeline.iter_items(
                "/v1/finder/memory",
                role=role,
                max_pages=3,
                location=key,
                verdict="keep",
                limit=200,
            )
        ]
    except PipelineError as error:
        if error.status in (404, 422):
            return []
        raise


async def _ranking_rows(
    pipeline: PipelineClient, job_id: str, role: KeyRole
) -> list[dict[str, Any]]:
    try:
        return [
            row
            async for row in pipeline.iter_items(
                f"/v1/jobs/{job_id}/ranking", role=role, max_pages=2, limit=200
            )
        ]
    except PipelineError as error:
        if error.status in (404, 410):
            return []
        raise


async def load_candidates(
    pipeline: PipelineClient,
    connection: AsyncConnection,
    query: SuggestionQuery,
    role: KeyRole,
) -> list[dict[str, Any]]:
    """Rankings of the last 5 location_industry jobs first, then memory rows."""
    jobs = await _recent_jobs(pipeline, query, role)
    if query.county and query.state:
        locations: list[tuple[str, str]] = [
            (normalise_county(query.county), query.state)
        ]
    else:
        locations = []
        for job in jobs:
            state = normalise_state_code(str(job.get("state_code") or ""))
            if state and job.get("county"):
                pair = (normalise_county(str(job["county"])), state)
                if pair not in locations:
                    locations.append(pair)
        for county, state in await sources.source_locations(connection):
            pair = (normalise_county(county), state)
            if pair not in locations:
                locations.append(pair)
        if query.state:
            locations = [pair for pair in locations if pair[1] == query.state]
        if query.county:
            wanted = normalise_county(query.county).casefold()
            locations = [pair for pair in locations if pair[0].casefold() == wanted]
        locations = locations[:MAX_LOCATIONS]
    ranking_jobs = jobs[:RANKING_JOBS]
    rankings = await asyncio.gather(
        *(_ranking_rows(pipeline, str(job["id"]), role) for job in ranking_jobs)
    )
    memory_batches = await asyncio.gather(
        *(
            _memory_rows(pipeline, key, role)
            for county, state in locations
            for key in location_keys(county, state)
        )
    )
    candidates: list[dict[str, Any]] = []
    for job, rows in zip(ranking_jobs, rankings, strict=True):
        ordered = sorted(
            rows,
            key=lambda row: (
                row.get("overall_rank") is None,
                row.get("overall_rank") or 0,
            ),
        )
        for row in ordered:
            item = suggestion_from_ranking(row, job)
            if item and item["state_code"]:
                candidates.append(item)
    memory_items: list[dict[str, Any]] = []
    pairs = [(county, state) for county, state in locations for _ in range(2)]
    for (county, state), rows in zip(pairs, memory_batches, strict=True):
        for row in rows:
            item = suggestion_from_memory(row, county, state)
            if item:
                memory_items.append(item)
    memory_items.sort(key=lambda item: str(item.get("judged_at") or ""), reverse=True)
    candidates.extend(memory_items)
    return candidates


async def collect_suggestions(
    pipeline: PipelineClient,
    connection: AsyncConnection,
    query: SuggestionQuery,
    role: KeyRole,
) -> list[dict[str, Any]]:
    """Cached candidates (60 s) minus the live listed/dismissed sets."""
    candidates = await candidate_cache.get_or_load(
        query.cache_key, lambda: load_candidates(pipeline, connection, query, role)
    )
    listed = await sources.listed_keys(connection)
    dismissed = await sources.dismissed_keys(connection)
    return merge_suggestions(
        candidates,
        listed=listed,
        dismissed=dismissed,
        industry=query.industry,
        limit=max(1, min(query.limit, MAX_LIMIT)),
    )
