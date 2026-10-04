"""Hourly purge: expired sessions, login attempts > 24 h, audit rows past retention."""

from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff.logging import get_logger

logger = get_logger("scout_bff.retention")
PURGE_INTERVAL_SECONDS = 3600
LOGIN_ATTEMPTS_RETENTION_HOURS = 24


async def purge_once(engine: AsyncEngine, audit_retention_days: int) -> dict[str, int]:
    """Delete what the contract says may go; returns the row counts removed."""
    async with engine.begin() as connection:
        sessions = await connection.execute(
            text("DELETE FROM ui.sessions WHERE expires_at <= now()")
        )
        attempts = await connection.execute(
            text(
                "DELETE FROM ui.login_attempts "
                "WHERE at < now() - make_interval(hours => :hours)"
            ),
            {"hours": LOGIN_ATTEMPTS_RETENTION_HOURS},
        )
        audit = await connection.execute(
            text(
                "DELETE FROM ui.audit_log "
                "WHERE at < now() - make_interval(days => :days)"
            ),
            {"days": audit_retention_days},
        )
    return {
        "sessions": sessions.rowcount or 0,
        "login_attempts": attempts.rowcount or 0,
        "audit_log": audit.rowcount or 0,
    }


async def run_retention(
    engine: AsyncEngine, settings: Any, interval: float = PURGE_INTERVAL_SECONDS
) -> None:
    """Background task started by the app lifespan; survives database hiccups."""
    while True:
        try:
            removed = await purge_once(engine, settings.ui_audit_retention_days)
            logger.info("retention_purge", **removed)
        except SQLAlchemyError as error:
            logger.warning("retention_purge_failed", error=type(error).__name__)
        await asyncio.sleep(interval)
