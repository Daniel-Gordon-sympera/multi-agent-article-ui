"""Async PostgreSQL engine (SQLAlchemy 2 Core + psycopg 3) for the `ui` schema."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

MIGRATION_HEAD = "0001_ui_schema"
VERSION_TABLE = "ui.alembic_version"
APPLICATION_NAME = "scout-ui"


def database_url(value: str) -> URL:
    """Accept postgres:// and postgresql:// spellings; always drive psycopg 3."""
    url = make_url(value)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername != "postgresql+psycopg":
        raise ValueError("UI_DATABASE_URL must use PostgreSQL with psycopg")
    return url


def create_database_engine(settings: Any) -> AsyncEngine:
    return create_async_engine(
        database_url(settings.ui_database_url),
        pool_size=settings.ui_db_pool_size,
        max_overflow=settings.ui_db_pool_size,
        pool_timeout=10,
        pool_pre_ping=True,
        connect_args={
            "application_name": APPLICATION_NAME,
            "options": "-c statement_timeout=30000",
        },
    )


@asynccontextmanager
async def transaction(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """One transaction per unit of work; commits on success, rolls back on error."""
    async with engine.begin() as connection:
        yield connection


async def database_reachable(engine: AsyncEngine) -> bool:
    async with engine.connect() as connection:
        return await connection.scalar(text("SELECT 1")) == 1


async def migrations_current(engine: AsyncEngine) -> bool:
    async with engine.connect() as connection:
        exists = await connection.scalar(
            text("SELECT to_regclass(:table)"), {"table": VERSION_TABLE}
        )
        if not exists:
            return False
        version = await connection.scalar(
            text(f"SELECT version_num FROM {VERSION_TABLE}")
        )
        return version == MIGRATION_HEAD
