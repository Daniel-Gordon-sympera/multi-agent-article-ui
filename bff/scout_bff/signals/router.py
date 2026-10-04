"""`GET /app/signals`, `/app/signals/summary`, `/app/signals/export.csv` (contract §4.4).

With the capability `signals_global` the read goes to `GET /v1/signals` (B1); without it
the bounded fallback merges the 20 most recent matching jobs' `/signals`. Every role may
read all three routes; the pipeline key follows the role (viewer → reader key).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.auth.roles import role_satisfies
from scout_bff.cursors import decode_offset_cursor, encode_offset_cursor
from scout_bff.pipeline_client import KeyRole, PipelineClient
from scout_bff.signals import global_read
from scout_bff.signals.csv_export import (
    CSV_MEDIA_TYPE,
    content_disposition,
    iterate_list,
    stream_csv,
)
from scout_bff.signals.fallback import SignalsCache, cached_merge
from scout_bff.signals.query import SignalsQuery
from scout_bff.signals.rows import filter_rows, page_rows, sort_rows, summarise

router = APIRouter(prefix="/app/signals", tags=["signals"])


def key_role(user: AuthenticatedUser) -> KeyRole:
    return "operator" if role_satisfies(user.role, "operator") else "viewer"


def signals_cache(request: Request) -> SignalsCache:
    cache = getattr(request.app.state, "signals_cache", None)
    if cache is None:
        cache = SignalsCache()
        request.app.state.signals_cache = cache
    return cache


def has_global_read(request: Request) -> bool:
    capabilities = request.app.state.capabilities.capabilities
    return bool(capabilities.get("signals_global"))


def pipeline_of(request: Request) -> PipelineClient:
    return request.app.state.pipeline


def _page_response(
    rows: list[dict[str, Any]], query: SignalsQuery, **extra: Any
) -> dict[str, Any]:
    offset = decode_offset_cursor(query.after, query.cursor_scope)
    page, next_offset = page_rows(rows, offset, query.limit)
    next_cursor = (
        encode_offset_cursor(query.cursor_scope, next_offset)
        if next_offset is not None
        else None
    )
    return {"items": page, "next_cursor": next_cursor, **extra}


async def _fallback_rows(
    request: Request, user: AuthenticatedUser, query: SignalsQuery
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    merged = await cached_merge(
        signals_cache(request),
        pipeline_of(request),
        request.app.state.engine,
        key_role(user),
        query,
    )
    rows = filter_rows(merged.rows, query.row_filters, query.free_text)
    meta = {
        "degraded": True,
        "scanned_jobs": merged.scanned_jobs,
        "truncated": merged.truncated,
    }
    return rows, meta


@router.get("")
async def list_signals(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    query = SignalsQuery.from_params(request.query_params)
    if has_global_read(request):
        pipeline, role = pipeline_of(request), key_role(user)
        if query.free_text is None:
            page = await global_read.forward_page(pipeline, role, query)
            return {**page, "degraded": False}
        rows, truncated = await global_read.pull_rows(pipeline, role, query)
        return _page_response(
            sort_rows(rows), query, degraded=False, truncated=truncated
        )
    rows, meta = await _fallback_rows(request, user, query)
    return _page_response(rows, query, **meta)


@router.get("/summary")
async def signals_summary(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> dict[str, Any]:
    query = SignalsQuery.from_params(request.query_params, paging=False)
    if has_global_read(request):
        rows, truncated = await global_read.pull_rows(
            pipeline_of(request), key_role(user), query
        )
        return {**summarise(rows), "degraded": False, "truncated": truncated}
    rows, meta = await _fallback_rows(request, user, query)
    return {**summarise(rows), **meta}


@router.get("/export.csv")
async def export_signals(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> StreamingResponse:
    query = SignalsQuery.from_params(request.query_params, paging=False)
    rows: AsyncIterator[dict[str, Any]]
    if has_global_read(request):
        rows = global_read.iterate_rows(
            pipeline_of(request),
            key_role(user),
            query,
            max_pages=global_read.MAX_EXPORT_PAGES,
        )
    else:
        merged_rows, _meta = await _fallback_rows(request, user, query)
        rows = iterate_list(merged_rows)
    return StreamingResponse(
        stream_csv(rows),
        media_type=CSV_MEDIA_TYPE,
        headers={"Content-Disposition": content_disposition()},
    )
