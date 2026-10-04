"""SQL for `ui.saved_views`: own views plus the shared ones (contract §4.3)."""

from __future__ import annotations

import json
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.errors import Problem

VIEW_COLUMNS = "id, user_id, name, route, search, columns, shared, created_at"


class ViewNameTaken(Exception):
    """Raised when `(user_id, route, name)` already exists."""


def view_json(row: dict[str, Any]) -> dict[str, Any]:
    search = row["search"]
    if isinstance(search, str):
        search = json.loads(search)
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "name": row["name"],
        "route": row["route"],
        "search": search if isinstance(search, dict) else {},
        "columns": list(row["columns"]) if row["columns"] is not None else None,
        "shared": bool(row["shared"]),
        "created_at": row["created_at"].isoformat(),
    }


async def list_views(
    connection: AsyncConnection, user_id: UUID, route: str | None
) -> list[dict[str, Any]]:
    """Own views and every shared view, optionally for one route; sorted by name."""
    sql = (
        f"SELECT {VIEW_COLUMNS} FROM ui.saved_views "
        "WHERE (user_id = :user_id OR shared) "
    )
    parameters: dict[str, Any] = {"user_id": user_id}
    if route:
        sql += "AND route = :route "
        parameters["route"] = route
    sql += "ORDER BY lower(name), created_at"
    result = await connection.execute(text(sql), parameters)
    return [dict(row) for row in result.mappings().all()]


async def get_view(connection: AsyncConnection, view_id: UUID) -> dict | None:
    result = await connection.execute(
        text(f"SELECT {VIEW_COLUMNS} FROM ui.saved_views WHERE id = :id"),
        {"id": view_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def require_view(connection: AsyncConnection, view_id: UUID) -> dict[str, Any]:
    view = await get_view(connection, view_id)
    if view is None:
        raise Problem(404, "view_not_found", "The saved view does not exist.")
    return view


async def create_view(
    connection: AsyncConnection,
    *,
    user_id: UUID,
    name: str,
    route: str,
    search: dict[str, Any],
    columns: list[str] | None,
    shared: bool,
) -> dict[str, Any]:
    view_id = uuid.uuid4()
    try:
        result = await connection.execute(
            text(
                "INSERT INTO ui.saved_views "
                "(id, user_id, name, route, search, columns, shared) "
                "VALUES (:id, :user_id, :name, :route, CAST(:search AS jsonb), "
                "CAST(:columns AS text[]), :shared) "
                f"RETURNING {VIEW_COLUMNS}"
            ),
            {
                "id": view_id,
                "user_id": user_id,
                "name": name,
                "route": route,
                "search": json.dumps(search),
                "columns": columns,
                "shared": shared,
            },
        )
    except IntegrityError as error:
        raise ViewNameTaken() from error
    return dict(result.mappings().one())


async def update_view(
    connection: AsyncConnection, view_id: UUID, changes: dict[str, Any]
) -> dict[str, Any]:
    """Apply the provided fields only; `search` is replaced whole."""
    assignments: list[str] = []
    parameters: dict[str, Any] = {"id": view_id}
    if "name" in changes:
        assignments.append("name = :name")
        parameters["name"] = changes["name"]
    if "search" in changes:
        assignments.append("search = CAST(:search AS jsonb)")
        parameters["search"] = json.dumps(changes["search"])
    if "columns" in changes:
        assignments.append("columns = CAST(:columns AS text[])")
        parameters["columns"] = changes["columns"]
    if "shared" in changes:
        assignments.append("shared = :shared")
        parameters["shared"] = changes["shared"]
    if not assignments:
        return await require_view(connection, view_id)
    try:
        result = await connection.execute(
            text(
                f"UPDATE ui.saved_views SET {', '.join(assignments)} "
                f"WHERE id = :id RETURNING {VIEW_COLUMNS}"
            ),
            parameters,
        )
    except IntegrityError as error:
        raise ViewNameTaken() from error
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "view_not_found", "The saved view does not exist.")
    return dict(row)


async def delete_view(connection: AsyncConnection, view_id: UUID) -> bool:
    result = await connection.execute(
        text("DELETE FROM ui.saved_views WHERE id = :id"), {"id": view_id}
    )
    return bool(result.rowcount)
