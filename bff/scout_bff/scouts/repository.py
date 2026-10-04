"""SQL for ui.scouts (contract §4.3, §4.8)."""

from __future__ import annotations

import json
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.errors import Problem

SCOUT_COLUMNS = (
    "id, name, kind, county, state_code, location, url, industries, source_mode, "
    "settings, created_by, created_at, updated_at, archived_at"
)


class ScoutExists(Exception):
    """Another Scout already carries this name (UNIQUE (name))."""


def _iso(value: Any) -> str | None:
    return value.isoformat() if value else None


def scout_json(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "kind": row["kind"],
        "county": row["county"],
        "state_code": row["state_code"],
        "location": row["location"],
        "url": row["url"],
        "industries": list(row["industries"] or []),
        "source_mode": row["source_mode"],
        "settings": dict(row["settings"] or {}),
        "created_by": str(row["created_by"]) if row["created_by"] else None,
        "created_at": _iso(row["created_at"]),
        "updated_at": _iso(row["updated_at"]),
        "archived_at": _iso(row["archived_at"]),
    }


async def list_scouts(
    connection: AsyncConnection, *, include_archived: bool = False
) -> list[dict[str, Any]]:
    where = "" if include_archived else "WHERE archived_at IS NULL"
    result = await connection.execute(
        text(f"SELECT {SCOUT_COLUMNS} FROM ui.scouts {where} ORDER BY lower(name)")
    )
    return [dict(row) for row in result.mappings().all()]


async def get_scout(connection: AsyncConnection, scout_id: UUID) -> dict | None:
    result = await connection.execute(
        text(f"SELECT {SCOUT_COLUMNS} FROM ui.scouts WHERE id = :id"), {"id": scout_id}
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def require_scout(connection: AsyncConnection, scout_id: UUID) -> dict[str, Any]:
    row = await get_scout(connection, scout_id)
    if row is None:
        raise Problem(404, "scout_not_found", "The Scout does not exist.")
    return row


async def lock_scout(connection: AsyncConnection, scout_id: UUID) -> dict[str, Any]:
    """The scout row locked for the current transaction (serialises run numbers)."""
    result = await connection.execute(
        text(f"SELECT {SCOUT_COLUMNS} FROM ui.scouts WHERE id = :id FOR UPDATE"),
        {"id": scout_id},
    )
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "scout_not_found", "The Scout does not exist.")
    return dict(row)


async def create_scout(
    connection: AsyncConnection,
    *,
    name: str,
    kind: str,
    county: str,
    state_code: str,
    location: str | None,
    url: str | None,
    industries: list[str],
    source_mode: str,
    settings: dict[str, Any],
    created_by: UUID | None,
) -> dict[str, Any]:
    try:
        result = await connection.execute(
            text(
                "INSERT INTO ui.scouts(id, name, kind, county, state_code, location, url, "
                "industries, source_mode, settings, created_by) VALUES (:id, :name, "
                ":kind, :county, :state_code, :location, :url, CAST(:industries AS "
                "text[]), :source_mode, CAST(:settings AS jsonb), :created_by) "
                f"RETURNING {SCOUT_COLUMNS}"
            ),
            {
                "id": uuid.uuid4(),
                "name": name,
                "kind": kind,
                "county": county,
                "state_code": state_code,
                "location": location,
                "url": url,
                "industries": industries,
                "source_mode": source_mode,
                "settings": json.dumps(settings),
                "created_by": created_by,
            },
        )
    except IntegrityError as error:
        raise ScoutExists(name) from error
    return dict(result.mappings().one())


async def update_scout(
    connection: AsyncConnection, scout_id: UUID, changes: dict[str, Any]
) -> dict[str, Any]:
    if not changes:
        return await require_scout(connection, scout_id)
    assignments, parameters = ["updated_at = now()"], {"id": scout_id}
    for column, value in changes.items():
        if column == "industries":
            assignments.append("industries = CAST(:industries AS text[])")
        elif column == "settings":
            assignments.append("settings = CAST(:settings AS jsonb)")
            value = json.dumps(value)
        else:
            assignments.append(f"{column} = :{column}")
        parameters[column] = value
    try:
        result = await connection.execute(
            text(
                f"UPDATE ui.scouts SET {', '.join(assignments)} WHERE id = :id "
                f"RETURNING {SCOUT_COLUMNS}"
            ),
            parameters,
        )
    except IntegrityError as error:
        raise ScoutExists(str(changes.get("name"))) from error
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "scout_not_found", "The Scout does not exist.")
    return dict(row)


async def archive_scout(connection: AsyncConnection, scout_id: UUID) -> None:
    result = await connection.execute(
        text(
            "UPDATE ui.scouts SET archived_at = coalesce(archived_at, now()), "
            "updated_at = now() WHERE id = :id"
        ),
        {"id": scout_id},
    )
    if not result.rowcount:
        raise Problem(404, "scout_not_found", "The Scout does not exist.")
