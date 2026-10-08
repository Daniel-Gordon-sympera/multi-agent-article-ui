"""/app/jobs/*: the progress aggregate for the Runs table and retry-all-dead."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from scout_bff.auth.deps import AuthenticatedUser, current_user, require_role
from scout_bff.auth.roles import role_satisfies
from scout_bff.jobs.progress import ProgressCache, collect_progress, parse_job_ids
from scout_bff.jobs.retry_dead import retry_dead_via_api
from scout_bff.pipeline_client import KeyRole, PipelineClient

router = APIRouter(prefix="/app", tags=["jobs"])


def key_role(user: AuthenticatedUser) -> KeyRole:
    """admin/operator read with the operator key, viewers with the reader key."""
    return "operator" if role_satisfies(user.role, "operator") else "viewer"


def progress_cache(request: Request) -> ProgressCache:
    cache = getattr(request.app.state, "jobs_progress_cache", None)
    if cache is None:
        cache = ProgressCache()
        request.app.state.jobs_progress_cache = cache
    return cache


def pipeline_of(request: Request) -> PipelineClient:
    return request.app.state.pipeline


@router.get("/jobs/progress")
async def jobs_progress(
    request: Request,
    job_ids: str = Query("", description="Comma-separated job ids (at most 50)"),
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    """`{[job_id]: {status, progress, cost_usd, sites_total, sites_done, duration_seconds}}`."""
    ids = parse_job_ids(job_ids)
    if not ids:
        return {}
    return await collect_progress(
        pipeline_of(request), progress_cache(request), ids, key_role(user)
    )


@router.post("/jobs/{job_id}/retry-dead")
async def retry_dead(
    request: Request,
    job_id: str,
    user: AuthenticatedUser = Depends(require_role("operator")),
) -> dict[str, Any]:
    """Re-queue every dead task of the job → `{retried, task_ids, skipped_task_ids}`."""
    pipeline = pipeline_of(request)
    result = await retry_dead_via_api(pipeline, job_id)
    request.state.audit_target = {
        "job_id": job_id,
        "retried": result["retried"],
        "task_ids": result["task_ids"],
        "basis": "api",
    }
    return result
