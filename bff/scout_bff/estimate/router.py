"""/app/estimate: the per-job cost estimate behind the New run Summary card."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.auth.roles import role_satisfies
from scout_bff.estimate.service import (
    EstimateCache,
    estimate_from_api,
)
from scout_bff.pipeline_client import KeyRole

router = APIRouter(prefix="/app", tags=["estimate"])

JobKind = Literal["location_industry", "seeds", "url"]


def estimate_cache(request: Request) -> EstimateCache:
    cache = getattr(request.app.state, "estimate_cache", None)
    if cache is None:
        cache = EstimateCache()
        request.app.state.estimate_cache = cache
    return cache


@router.get("/estimate")
async def estimate(
    request: Request,
    kind: JobKind = Query("location_industry"),
    sites: int | None = Query(None, ge=1, le=1000),
    days: int | None = Query(None, ge=1, le=3650),
    industry: str | None = Query(None, max_length=200),
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    """`{median_cost_usd, p90_cost_usd, samples, basis}` or `{samples: 0}`."""
    industry = industry.strip() if industry and industry.strip() else None
    role: KeyRole = "operator" if role_satisfies(user.role, "operator") else "viewer"
    cache = estimate_cache(request)
    key = (kind, sites, days, industry.lower() if industry else None)
    cached = cache.get(key)
    if cached is not None:
        return cached
    pipeline = request.app.state.pipeline
    result = await estimate_from_api(pipeline, role, kind, sites, industry, days)
    cache.put(key, result)
    return result
