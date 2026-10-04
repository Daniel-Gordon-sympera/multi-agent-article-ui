"""Reads through `GET /v1/signals` (B1) once the capability `signals_global` exists."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from scout_bff.pipeline_client import KeyRole, PipelineClient
from scout_bff.signals.query import SignalsQuery
from scout_bff.signals.rows import matches_free_text, normalise_global_row

GLOBAL_PAGE_SIZE = 1000
# Bound of the BFF-side computations (summary, free-text search) over the global read.
MAX_SUMMARY_ROWS = 2000
# Bound of the streamed CSV export: 20 pages of 1,000 rows.
MAX_EXPORT_PAGES = 20
SIGNALS_PATH = "/v1/signals"


def _rows(page: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        normalise_global_row(row)
        for row in page.get("items", [])
        if isinstance(row, dict)
    ]


async def forward_page(
    pipeline: PipelineClient, role: KeyRole, query: SignalsQuery
) -> dict[str, Any]:
    """The API's own page for this query (contract §4.4: forward and return)."""
    page = await pipeline.get_json(SIGNALS_PATH, role=role, **query.forwarded())
    return {"items": _rows(page), "next_cursor": page.get("next_cursor")}


def _pull_params(query: SignalsQuery) -> dict[str, str]:
    params = query.forwarded()
    params.pop("after", None)
    params["limit"] = str(GLOBAL_PAGE_SIZE)
    return params


async def iterate_rows(
    pipeline: PipelineClient,
    role: KeyRole,
    query: SignalsQuery,
    *,
    max_pages: int,
) -> AsyncIterator[dict[str, Any]]:
    """Every row the API returns for the forwarded filters, `q` applied here."""
    params = _pull_params(query)
    after: str | None = None
    for _ in range(max_pages):
        page = await pipeline.get_json(SIGNALS_PATH, role=role, after=after, **params)
        for row in _rows(page):
            if matches_free_text(row, query.free_text):
                yield row
        after = page.get("next_cursor")
        if not after:
            return


async def pull_rows(
    pipeline: PipelineClient,
    role: KeyRole,
    query: SignalsQuery,
    *,
    max_rows: int = MAX_SUMMARY_ROWS,
) -> tuple[list[dict[str, Any]], bool]:
    """Up to `max_rows` rows for BFF-side computations; `truncated` when more exist."""
    params = _pull_params(query)
    rows: list[dict[str, Any]] = []
    after: str | None = None
    while len(rows) < max_rows:
        params["limit"] = str(min(GLOBAL_PAGE_SIZE, max_rows - len(rows)))
        page = await pipeline.get_json(SIGNALS_PATH, role=role, after=after, **params)
        rows.extend(
            row for row in _rows(page) if matches_free_text(row, query.free_text)
        )
        after = page.get("next_cursor")
        if not after:
            return rows, False
    return rows, True
