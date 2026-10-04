"""SQL for ui.batches and ui.batch_jobs (contract §4.5, §4.8)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.errors import Problem

BATCH_COLUMNS = (
    "b.id, b.scout_id, s.name AS scout_name, b.run_number, b.requested, b.created_by, "
    "b.created_at"
)
LEG_COLUMNS = "batch_id, position, industry, job_id, client_reference, error"
BATCH_FROM = "ui.batches b LEFT JOIN ui.scouts s ON s.id = b.scout_id"


def _iso(value: Any) -> str | None:
    return value.isoformat() if value else None


def leg_json(row: dict[str, Any], status: str | None = None) -> dict[str, Any]:
    error = row.get("error")
    return {
        "position": int(row["position"]),
        "industry": row.get("industry"),
        "job_id": str(row["job_id"]) if row.get("job_id") else None,
        "client_reference": row["client_reference"],
        "status": status,
        "error": error.get("detail") if isinstance(error, dict) else error,
    }


def batch_json(
    row: dict[str, Any], legs: list[dict[str, Any]], statuses: dict[str, str | None]
) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "scout_id": str(row["scout_id"]) if row.get("scout_id") else None,
        "scout_name": row.get("scout_name"),
        "run_number": row.get("run_number"),
        "created_at": _iso(row["created_at"]),
        "jobs": [
            leg_json(
                leg, statuses.get(str(leg["job_id"])) if leg.get("job_id") else None
            )
            for leg in legs
        ],
    }


async def count_batches(connection: AsyncConnection, scout_id: UUID) -> int:
    value = await connection.scalar(
        text("SELECT count(*) FROM ui.batches WHERE scout_id = :scout_id"),
        {"scout_id": scout_id},
    )
    return int(value or 0)


async def insert_batch(
    connection: AsyncConnection,
    *,
    batch_id: UUID,
    scout_id: UUID | None,
    run_number: int | None,
    requested: dict[str, Any],
    created_by: UUID | None,
) -> None:
    await connection.execute(
        text(
            "INSERT INTO ui.batches(id, scout_id, run_number, requested, created_by) "
            "VALUES (:id, :scout_id, :run_number, CAST(:requested AS jsonb), :created_by)"
        ),
        {
            "id": batch_id,
            "scout_id": scout_id,
            "run_number": run_number,
            "requested": json.dumps(requested, default=str),
            "created_by": created_by,
        },
    )


async def insert_leg(
    connection: AsyncConnection,
    *,
    batch_id: UUID,
    position: int,
    industry: str | None,
    client_reference: str,
    job_id: str | None,
    error: dict[str, Any] | None,
) -> None:
    await connection.execute(
        text(
            "INSERT INTO ui.batch_jobs(batch_id, position, industry, job_id, "
            "client_reference, error) VALUES (:batch_id, :position, :industry, "
            "CAST(:job_id AS uuid), :client_reference, CAST(:error AS jsonb))"
        ),
        {
            "batch_id": batch_id,
            "position": position,
            "industry": industry,
            "job_id": job_id,
            "client_reference": client_reference,
            "error": json.dumps(error, default=str) if error is not None else None,
        },
    )


async def delete_batch(connection: AsyncConnection, batch_id: UUID) -> None:
    await connection.execute(
        text("DELETE FROM ui.batch_jobs WHERE batch_id = :id"), {"id": batch_id}
    )
    await connection.execute(
        text("DELETE FROM ui.batches WHERE id = :id"), {"id": batch_id}
    )


async def get_batch(connection: AsyncConnection, batch_id: UUID) -> dict[str, Any]:
    result = await connection.execute(
        text(f"SELECT {BATCH_COLUMNS} FROM {BATCH_FROM} WHERE b.id = :id"),
        {"id": batch_id},
    )
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "batch_not_found", "The batch does not exist.")
    return dict(row)


async def batch_legs(
    connection: AsyncConnection, batch_ids: list[UUID]
) -> dict[str, list[dict[str, Any]]]:
    """Legs grouped by batch id (as strings), ordered by position."""
    if not batch_ids:
        return {}
    result = await connection.execute(
        text(
            f"SELECT {LEG_COLUMNS} FROM ui.batch_jobs WHERE batch_id = ANY(CAST(:ids AS "
            "uuid[])) ORDER BY batch_id, position"
        ),
        {"ids": [str(batch_id) for batch_id in batch_ids]},
    )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in result.mappings().all():
        grouped.setdefault(str(row["batch_id"]), []).append(dict(row))
    return grouped


async def memberships(
    connection: AsyncConnection, job_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """`GET /app/batches?job_ids=` rows: one membership per known job id."""
    if not job_ids:
        return {}
    result = await connection.execute(
        text(
            "SELECT bj.job_id, bj.position, b.id AS batch_id, b.scout_id, s.name AS "
            "scout_name, b.run_number, (SELECT count(*) FROM ui.batch_jobs x WHERE "
            "x.batch_id = b.id) AS size FROM ui.batch_jobs bj JOIN ui.batches b ON "
            "b.id = bj.batch_id LEFT JOIN ui.scouts s ON s.id = b.scout_id WHERE "
            "bj.job_id = ANY(CAST(:ids AS uuid[]))"
        ),
        {"ids": job_ids},
    )
    return {
        str(row["job_id"]): {
            "batch_id": str(row["batch_id"]),
            "position": int(row["position"]),
            "size": int(row["size"]),
            "scout_id": str(row["scout_id"]) if row["scout_id"] else None,
            "scout_name": row["scout_name"],
            "run_number": row["run_number"],
        }
        for row in result.mappings().all()
    }


async def scout_batches(
    connection: AsyncConnection, scout_id: UUID, *, limit: int
) -> list[dict[str, Any]]:
    """The newest `limit` batches of a Scout with their legs."""
    result = await connection.execute(
        text(
            f"SELECT {BATCH_COLUMNS} FROM {BATCH_FROM} WHERE b.scout_id = :scout_id "
            "ORDER BY b.created_at DESC, b.run_number DESC NULLS LAST LIMIT :limit"
        ),
        {"scout_id": scout_id, "limit": limit},
    )
    batches = [dict(row) for row in result.mappings().all()]
    legs = await batch_legs(connection, [batch["id"] for batch in batches])
    for batch in batches:
        batch["legs"] = legs.get(str(batch["id"]), [])
    return batches


async def last_batches_by_scout(
    connection: AsyncConnection,
) -> dict[str, dict[str, Any]]:
    """Per scout: `runs_count` and the newest batch (with legs) — for `GET /app/scouts`."""
    result = await connection.execute(
        text(
            "SELECT DISTINCT ON (b.scout_id) b.scout_id, b.id, b.run_number, "
            "b.created_at, count(*) OVER (PARTITION BY b.scout_id) AS runs_count "
            "FROM ui.batches b WHERE b.scout_id IS NOT NULL "
            "ORDER BY b.scout_id, b.created_at DESC, b.run_number DESC NULLS LAST"
        )
    )
    rows = [dict(row) for row in result.mappings().all()]
    legs = await batch_legs(connection, [row["id"] for row in rows])
    return {
        str(row["scout_id"]): {
            "runs_count": int(row["runs_count"]),
            "batch_id": str(row["id"]),
            "run_number": row["run_number"],
            "created_at": _iso(row["created_at"]),
            "legs": legs.get(str(row["id"]), []),
        }
        for row in rows
    }
