"""`/app/batches*`: one-off fan-out, membership lookup and batch detail (contract §4.3)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from scout_bff.auth.deps import AuthenticatedUser, current_user, require_role
from scout_bff.batches import repository as batches
from scout_bff.batches.models import BatchInput
from scout_bff.batches.service import job_statuses, run_fan_out

router = APIRouter(prefix="/app/batches", tags=["batches"])
MAX_LOOKUP_IDS = 500


def parse_job_ids(raw: str | None) -> list[str]:
    """Comma-separated UUIDs; malformed entries are ignored, duplicates collapsed."""
    seen: list[str] = []
    for part in (raw or "").split(","):
        text = part.strip()
        if not text:
            continue
        try:
            value = str(UUID(text))
        except ValueError:
            continue
        if value not in seen:
            seen.append(value)
    return seen[:MAX_LOOKUP_IDS]


@router.post("", status_code=201)
async def create_batch(
    request: Request,
    response: Response,
    body: BatchInput,
    user: AuthenticatedUser = Depends(require_role("operator")),
) -> dict[str, Any]:
    batch = await run_fan_out(
        request.app.state.engine, request.app.state.pipeline, user, body
    )
    request.state.audit_target = {
        "batch_id": batch["id"],
        "scout_id": batch["scout_id"],
        "job_ids": [leg["job_id"] for leg in batch["jobs"] if leg["job_id"]],
    }
    response.headers["Location"] = f"/app/batches/{batch['id']}"
    return batch


@router.get("", dependencies=[Depends(current_user)])
async def lookup_batches(
    request: Request, job_ids: str | None = Query(default=None, max_length=20_000)
) -> dict[str, Any]:
    ids = parse_job_ids(job_ids)
    async with request.app.state.engine.connect() as connection:
        found = await batches.memberships(connection, ids)
    return {"batches": found}


@router.get("/{batch_id}")
async def get_batch(
    request: Request, batch_id: UUID, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        row = await batches.get_batch(connection, batch_id)
        legs = (await batches.batch_legs(connection, [batch_id])).get(str(batch_id), [])
    job_ids = [str(leg["job_id"]) for leg in legs if leg.get("job_id")]
    statuses = await job_statuses(request.app.state.pipeline, job_ids, user.role)
    return batches.batch_json(row, legs, statuses)
