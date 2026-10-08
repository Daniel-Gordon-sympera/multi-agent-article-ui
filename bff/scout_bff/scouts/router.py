"""`/app/scouts*`: saved setups, archive, run (fan-out) and run history (contract §4.3)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from scout_bff.auth.deps import AuthenticatedUser, current_user, require_role
from scout_bff.batches.models import BatchInput
from scout_bff.batches.service import run_fan_out
from scout_bff.errors import Problem
from scout_bff.pipeline_client import KeyRole
from scout_bff.scouts import repository as scouts
from scout_bff.scouts.job_history import scout_jobs_page
from scout_bff.scouts.models import (
    JobSettingsInput,
    RunScoutInput,
    ScoutInput,
    ScoutUpdate,
)
from scout_bff.scouts.runs import scouts_with_runs

router = APIRouter(prefix="/app/scouts", tags=["scouts"])
operator = Depends(require_role("operator"))


def key_role(user: AuthenticatedUser) -> KeyRole:
    return "viewer" if user.role == "viewer" else "operator"


def scout_exists_problem() -> Problem:
    return Problem(409, "scout_exists", "A Scout with this name already exists.")


@router.get("")
async def list_scouts(
    request: Request,
    user: AuthenticatedUser = Depends(current_user),
    archived: bool = Query(default=False),
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        rows = await scouts.list_scouts(connection, include_archived=archived)
        items = await scouts_with_runs(
            connection, request.app.state.pipeline, rows, key_role(user)
        )
    return {"items": items}


@router.post("", status_code=201, dependencies=[operator])
async def create_scout(
    request: Request, body: ScoutInput, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    try:
        async with request.app.state.engine.begin() as connection:
            row = await scouts.create_scout(
                connection,
                name=body.name,
                kind=body.kind,
                county=body.county,
                state_code=body.state_code,
                location=body.location,
                url=body.url,
                industries=body.industries,
                source_mode=body.source_mode,
                settings=body.settings.overrides(),
                created_by=user.id,
            )
    except scouts.ScoutExists:
        raise scout_exists_problem() from None
    request.state.audit_target = {"scout_id": str(row["id"])}
    return scouts.scout_json(row)


@router.get("/{scout_id}", dependencies=[Depends(current_user)])
async def get_scout(request: Request, scout_id: UUID) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        row = await scouts.require_scout(connection, scout_id)
    return scouts.scout_json(row)


@router.patch("/{scout_id}", dependencies=[operator])
async def update_scout(
    request: Request, scout_id: UUID, body: ScoutUpdate
) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True)
    if "settings" in changes:
        settings = body.settings or JobSettingsInput()
        changes["settings"] = settings.overrides()
    try:
        async with request.app.state.engine.begin() as connection:
            current = await scouts.require_scout(connection, scout_id)
            merged = {**current, **changes}
            if merged["kind"] == "url" and not merged.get("url"):
                raise Problem(422, "validation_error", "A site URL is required.")
            if merged["kind"] == "location_industry" and not merged.get("industries"):
                raise Problem(422, "validation_error", "Pick at least one industry.")
            row = await scouts.update_scout(connection, scout_id, changes)
    except scouts.ScoutExists:
        raise scout_exists_problem() from None
    request.state.audit_target = {"scout_id": str(scout_id)}
    return scouts.scout_json(row)


@router.delete("/{scout_id}", status_code=204, response_class=Response)
async def archive_scout(
    request: Request, scout_id: UUID, user: AuthenticatedUser = operator
) -> Response:
    async with request.app.state.engine.begin() as connection:
        await scouts.archive_scout(connection, scout_id)
    request.state.audit_target = {"scout_id": str(scout_id)}
    return Response(status_code=204)


@router.post("/{scout_id}/run", status_code=201)
async def run_scout(
    request: Request,
    response: Response,
    scout_id: UUID,
    body: RunScoutInput | None = None,
    user: AuthenticatedUser = operator,
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        scout = await scouts.require_scout(connection, scout_id)
    if scout["archived_at"] is not None:
        raise Problem(409, "scout_archived", "This Scout is archived.")
    batch_input = BatchInput(
        kind=scout["kind"],
        county=scout["county"],
        state_code=scout["state_code"],
        location=scout["location"],
        url=scout["url"],
        industries=list(scout["industries"] or []),
        settings=JobSettingsInput(**dict(scout["settings"] or {})),
        scout_id=str(scout_id),
        client_reference_suffix=body.client_reference_suffix if body else None,
    )
    batch = await run_fan_out(
        request.app.state.engine, request.app.state.pipeline, user, batch_input
    )
    request.state.audit_target = {
        "scout_id": str(scout_id),
        "batch_id": batch["id"],
        "job_ids": [leg["job_id"] for leg in batch["jobs"] if leg["job_id"]],
    }
    response.headers["Location"] = f"/app/batches/{batch['id']}"
    return batch


@router.get("/{scout_id}/jobs")
async def list_scout_jobs(
    request: Request, scout_id: UUID, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        await scouts.require_scout(connection, scout_id)
        return await scout_jobs_page(
            connection,
            request.app.state.pipeline,
            scout_id,
            key_role(user),
            dict(request.query_params),
        )
