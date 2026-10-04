"""Alembic environment for schema `ui`; the URL comes from UI_DATABASE_URL."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine, pool, text

configuration = context.config
VERSION_TABLE_SCHEMA = "ui"


def database_url() -> str:
    value = os.environ.get("UI_DATABASE_URL") or configuration.get_main_option(
        "sqlalchemy.url"
    )
    if not value:
        raise RuntimeError("Set UI_DATABASE_URL (owner URL) to run migrations.")
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    return value


def ensure_prerequisites(connection) -> None:
    """Bootstrap normally creates these; guard bare `alembic upgrade head` runs."""
    if connection.scalar(text("SELECT to_regnamespace('ui')")) is None:
        connection.execute(text("CREATE SCHEMA ui"))
    has_citext = connection.scalar(
        text("SELECT 1 FROM pg_extension WHERE extname = 'citext'")
    )
    if has_citext is None:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=VERSION_TABLE_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_with(connection) -> None:
    ensure_prerequisites(connection)
    context.configure(connection=connection, version_table_schema=VERSION_TABLE_SCHEMA)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    existing = configuration.attributes.get("connection")
    if existing is not None:
        run_migrations_with(existing)
        return
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        run_migrations_with(connection)
        connection.commit()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
