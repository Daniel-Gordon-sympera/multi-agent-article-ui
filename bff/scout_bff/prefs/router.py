"""GET /app/prefs and PUT /app/prefs (partial merge) — contract §4.3."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.errors import Problem
from scout_bff.prefs import repository
from scout_bff.prefs.schema import PrefsPatch

router = APIRouter(prefix="/app", tags=["prefs"])


@router.get("/prefs")
async def get_prefs(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        return await repository.load_prefs(connection, user.id)


@router.put("/prefs")
async def put_prefs(
    request: Request,
    body: PrefsPatch,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    patch = body.as_patch()
    if not patch:
        raise Problem(
            422, "validation_error", "Send at least one preference to change."
        )
    async with request.app.state.engine.begin() as connection:
        merged = await repository.merge_prefs(connection, user.id, patch)
    request.state.audit_target = {"prefs": sorted(patch)}
    return merged
