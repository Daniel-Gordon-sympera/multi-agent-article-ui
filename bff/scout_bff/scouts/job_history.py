"""Complete Scout run history; membership belongs to UI, job filters to the API."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.cursors import cursor_scope, decode_cursor, encode_cursor
from scout_bff.errors import Problem
from scout_bff.pipeline_client import KeyRole, PipelineClient

FILTERS = {
    "status",
    "status_group",
    "county",
    "state",
    "kind",
    "industry",
    "q",
    "created_after",
    "created_before",
}


def page_parameters(parameters: dict[str, str]) -> tuple[dict[str, str], int]:
    unknown = set(parameters) - FILTERS - {"limit", "after", "order"}
    if unknown:
        raise Problem(
            422, "unknown_filter", f"Unsupported filters: {', '.join(sorted(unknown))}."
        )
    if parameters.get("order", "created_desc") != "created_desc":
        raise Problem(422, "invalid_order", "Scout history uses order=created_desc.")
    try:
        limit = int(parameters.get("limit", "50"))
    except ValueError:
        limit = 0
    if not 1 <= limit <= 200:
        raise Problem(422, "invalid_limit", "limit must be between 1 and 200.")
    return {k: v for k, v in parameters.items() if k in FILTERS and v}, limit


def row_key(row: dict[str, Any]) -> tuple[str, str]:
    return str(row.get("created_at") or ""), str(row["id"])


async def scout_jobs_page(
    connection: AsyncConnection,
    pipeline: PipelineClient,
    scout_id: Any,
    role: KeyRole,
    parameters: dict[str, str],
) -> dict[str, Any]:
    filters, limit = page_parameters(parameters)
    scope = cursor_scope("scout-jobs", {"scout_id": str(scout_id), **filters})
    after = None
    if parameters.get("after"):
        try:
            decoded = json.loads(decode_cursor(parameters["after"], scope))
            if (
                not isinstance(decoded, list)
                or len(decoded) != 2
                or not all(isinstance(value, str) for value in decoded)
            ):
                raise ValueError
            after = tuple(decoded)
        except (ValueError, TypeError):
            raise Problem(
                400, "invalid_cursor", "Invalid Scout history cursor."
            ) from None
    result = await connection.execute(
        text(
            "SELECT bj.job_id FROM ui.batch_jobs bj JOIN ui.batches b ON b.id=bj.batch_id "
            "WHERE b.scout_id=:scout_id AND bj.job_id IS NOT NULL"
        ),
        {"scout_id": scout_id},
    )
    membership = {str(row[0]) for row in result}
    rows = []
    async for job in pipeline.iter_items(
        "/v1/jobs", role=role, order="created_desc", limit=1000, **filters
    ):
        if str(job["id"]) not in membership or (
            after is not None and row_key(job) >= after
        ):
            continue
        rows.append(job)
        if len(rows) > limit:
            break
    return {
        "items": rows[:limit],
        "next_cursor": encode_cursor(scope, json.dumps(row_key(rows[limit - 1])))
        if len(rows) > limit
        else None,
    }
