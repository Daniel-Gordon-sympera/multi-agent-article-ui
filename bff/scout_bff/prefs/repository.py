"""SQL for ui.preferences: one jsonb document per user, merged on PUT."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.prefs.schema import DEFAULT_PREFS, sanitise_prefs


async def load_prefs(connection: AsyncConnection, user_id: UUID) -> dict[str, Any]:
    """Stored values over the defaults; unknown or invalid stored values are dropped."""
    stored = await connection.scalar(
        text("SELECT prefs FROM ui.preferences WHERE user_id = :user_id"),
        {"user_id": user_id},
    )
    if isinstance(stored, str):
        try:
            stored = json.loads(stored)
        except ValueError:
            stored = None
    return {**DEFAULT_PREFS, **sanitise_prefs(stored)}


async def merge_prefs(
    connection: AsyncConnection, user_id: UUID, patch: dict[str, Any]
) -> dict[str, Any]:
    """Upsert `prefs || patch` and return the merged document with defaults applied."""
    await connection.execute(
        text(
            "INSERT INTO ui.preferences(user_id, prefs) "
            "VALUES (:user_id, CAST(:patch AS jsonb)) "
            "ON CONFLICT (user_id) DO UPDATE "
            "SET prefs = ui.preferences.prefs || EXCLUDED.prefs"
        ),
        {"user_id": user_id, "patch": json.dumps(patch)},
    )
    return await load_prefs(connection, user_id)
