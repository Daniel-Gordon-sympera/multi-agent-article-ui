"""Cross-job results are authoritative pipeline reads, with no local row caps."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.auth.roles import role_satisfies
from scout_bff.pipeline_client import KeyRole
from scout_bff.proxy.router import passthrough_headers
from scout_bff.signals.query import SignalsQuery

router = APIRouter(prefix="/app/signals", tags=["signals"])


def key_role(user: AuthenticatedUser) -> KeyRole:
    return "operator" if role_satisfies(user.role, "operator") else "viewer"


@router.get("")
async def list_signals(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    query = SignalsQuery.from_params(request.query_params)
    return await request.app.state.pipeline.get_json(
        "/v1/signals", role=key_role(user), **query.forwarded()
    )


@router.get("/summary")
async def signals_summary(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    query = SignalsQuery.from_params(request.query_params, paging=False)
    return await request.app.state.pipeline.get_json(
        "/v1/signals/summary", role=key_role(user), **query.forwarded(paging=False)
    )


@router.get("/export.csv")
async def export_signals(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> StreamingResponse:
    query = SignalsQuery.from_params(request.query_params, paging=False)
    upstream = await request.app.state.pipeline.request(
        "GET",
        "/v1/signals/export.csv",
        role=key_role(user),
        params=query.forwarded(paging=False),
        stream=True,
    )
    return StreamingResponse(
        upstream.aiter_bytes(),
        status_code=upstream.status_code,
        headers=passthrough_headers(upstream),
        background=BackgroundTask(upstream.aclose),
    )
