"""GET /app/attention → `{items: AttentionItem[]}` (contract §4.3), cached 10 s."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from scout_bff.attention.service import AttentionBuilder
from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.overview.cache import ATTENTION_TTL_SECONDS, request_cache
from scout_bff.overview.pipeline_reads import key_role_for

router = APIRouter(prefix="/app", tags=["attention"])


@router.get("/attention")
async def get_attention(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    builder = AttentionBuilder(
        request.app.state.pipeline,
        request.app.state.capabilities,
        key_role_for(user.role),
    )
    return await request_cache(request).get_or_compute(
        "attention", ATTENTION_TTL_SECONDS, builder.build
    )
