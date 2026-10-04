"""`python -m scout_bff.bootstrap`: schema, roles, grants, migrations, first admin."""

from __future__ import annotations

import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from scout_bff.auth.passwords import hash_password, validate_password_policy
from scout_bff.db import MIGRATION_HEAD, database_url
from scout_bff.settings import Settings

MIGRATIONS_DIRECTORY = Path(__file__).parent / "migrations"
SCHEMA = "ui"
SERVICE_ROLE = "svc_ui"
LOGIN_ROLE = "app_ui"
BOOTSTRAP_LOCK = "scout_ui.bootstrap"


@dataclass
class BootstrapReport:
    database: str
    steps: list[str] = field(default_factory=list)
    migration_before: str | None = None
    migration_after: str | None = None
    admin_created: bool = False

    def note(self, message: str) -> None:
        self.steps.append(message)

    def summary(self) -> str:
        lines = [f"scout bootstrap: database={self.database}"]
        lines.extend(f"  {step}" for step in self.steps)
        return "\n".join(lines)


def alembic_config(connection: Connection) -> Config:
    """Alembic configuration bound to an open connection; no alembic.ini needed."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIRECTORY))
    config.set_main_option("path_separator", "os")
    config.attributes["connection"] = connection
    return config


def run_alembic(connection: Connection, direction: str, revision: str) -> None:
    config = alembic_config(connection)
    if direction == "upgrade":
        command.upgrade(config, revision)
    elif direction == "downgrade":
        command.downgrade(config, revision)
    else:
        raise ValueError(f"Unknown Alembic direction {direction!r}")


def current_revision(connection: Connection) -> str | None:
    exists = connection.scalar(text("SELECT to_regclass('ui.alembic_version')"))
    if not exists:
        return None
    return connection.scalar(text("SELECT version_num FROM ui.alembic_version"))


def role_exists(connection: Connection, name: str) -> bool:
    return (
        connection.scalar(
            text("SELECT 1 FROM pg_roles WHERE rolname = :name"), {"name": name}
        )
        is not None
    )


def ensure_extension(connection: Connection, report: BootstrapReport) -> None:
    present = connection.scalar(
        text("SELECT 1 FROM pg_extension WHERE extname = 'citext'")
    )
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
    report.note(f"citext extension: {'present' if present else 'created'}")


def ensure_service_role(connection: Connection, report: BootstrapReport) -> None:
    if role_exists(connection, SERVICE_ROLE):
        report.note(f"role {SERVICE_ROLE}: present")
        return
    connection.execute(text(f"CREATE ROLE {SERVICE_ROLE} NOLOGIN"))
    report.note(f"role {SERVICE_ROLE}: created")


def ensure_schema(connection: Connection, report: BootstrapReport) -> None:
    exists = connection.scalar(text(f"SELECT to_regnamespace('{SCHEMA}')"))
    if exists is None:
        connection.execute(text(f"CREATE SCHEMA {SCHEMA} AUTHORIZATION {SERVICE_ROLE}"))
        report.note(f"schema {SCHEMA}: created (owner {SERVICE_ROLE})")
    else:
        connection.execute(text(f"ALTER SCHEMA {SCHEMA} OWNER TO {SERVICE_ROLE}"))
        report.note(f"schema {SCHEMA}: present (owner {SERVICE_ROLE})")


def ensure_login_role(
    connection: Connection, settings: Settings, report: BootstrapReport
) -> None:
    password = settings.ui_database_password.get_secret_value()
    exists = role_exists(connection, LOGIN_ROLE)
    if not exists and not password:
        raise RuntimeError(
            f"UI_DATABASE_PASSWORD is required to create the login role {LOGIN_ROLE}."
        )
    if not exists:
        connection.execute(text(f"CREATE ROLE {LOGIN_ROLE} LOGIN"))
    if password:
        # format(%L) quotes the literal server-side; the password never enters SQL text.
        statement = connection.scalar(
            text(
                f"SELECT format('ALTER ROLE {LOGIN_ROLE} WITH LOGIN PASSWORD %L', "
                "CAST(:password AS text))"
            ),
            {"password": password},
        )
        connection.execute(text(statement))
    connection.execute(text(f"GRANT {SERVICE_ROLE} TO {LOGIN_ROLE}"))
    state = "created" if not exists else "present"
    report.note(
        f"role {LOGIN_ROLE}: {state} ({'password set' if password else 'no password change'})"
    )


def apply_grants(
    connection: Connection, database: str, report: BootstrapReport | None = None
) -> None:
    """Run before and after the migration so new tables are covered either way."""
    statements = (
        f"REVOKE ALL ON SCHEMA {SCHEMA} FROM PUBLIC",
        f"GRANT USAGE, CREATE ON SCHEMA {SCHEMA} TO {SERVICE_ROLE}",
        f"GRANT ALL ON ALL TABLES IN SCHEMA {SCHEMA} TO {SERVICE_ROLE}",
        f"GRANT ALL ON ALL SEQUENCES IN SCHEMA {SCHEMA} TO {SERVICE_ROLE}",
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA {SCHEMA} GRANT ALL ON TABLES TO {SERVICE_ROLE}",
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA {SCHEMA} GRANT ALL ON SEQUENCES TO {SERVICE_ROLE}",
        f'GRANT CONNECT ON DATABASE "{database}" TO {LOGIN_ROLE}',
    )
    for statement in statements:
        connection.execute(text(statement))
    if report is not None:
        report.note(f"grants: {SERVICE_ROLE} owns ui.*, {LOGIN_ROLE} inherits it")


def migrate(connection: Connection, report: BootstrapReport) -> None:
    report.migration_before = current_revision(connection)
    run_alembic(connection, "upgrade", "head")
    report.migration_after = current_revision(connection)
    report.note(
        f"migrations: {report.migration_after} "
        f"(was {report.migration_before or 'none'}; head {MIGRATION_HEAD})"
    )


def bootstrap_admin(
    connection: Connection, settings: Settings, report: BootstrapReport
) -> None:
    email = settings.ui_bootstrap_admin_email.strip()
    password = settings.ui_bootstrap_admin_password.get_secret_value()
    users = connection.scalar(text("SELECT count(*) FROM ui.users")) or 0
    if users:
        report.note(f"admin: skipped ({users} account(s) exist)")
        return
    if not email or not password:
        report.note("admin: skipped (UI_BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set)")
        return
    validate_password_policy(password)
    connection.execute(
        text(
            "INSERT INTO ui.users(id, email, name, role, password_hash, "
            "must_change_password) VALUES (:id, CAST(:email AS citext), :name, "
            "'admin', :hash, true)"
        ),
        {
            "id": uuid.uuid4(),
            "email": email,
            "name": "Administrator",
            "hash": hash_password(password),
        },
    )
    report.admin_created = True
    report.note(f"admin: created {email} (must change password at first sign-in)")


def run_bootstrap(settings: Settings, engine: Engine | None = None) -> BootstrapReport:
    """Idempotent; every step is safe to repeat. Raises on failure."""
    url = database_url(settings.ui_database_url)
    report = BootstrapReport(database=url.database or "")
    owns_engine = engine is None
    engine = engine or create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": BOOTSTRAP_LOCK},
            )
            ensure_extension(connection, report)
            ensure_service_role(connection, report)
            ensure_schema(connection, report)
            ensure_login_role(connection, settings, report)
            apply_grants(connection, report.database, report)
        with engine.begin() as connection:
            migrate(connection, report)
        with engine.begin() as connection:
            apply_grants(connection, report.database)
            bootstrap_admin(connection, settings, report)
    finally:
        if owns_engine:
            engine.dispose()
    return report


def main() -> int:
    try:
        settings = Settings()
        report = run_bootstrap(settings)
    except Exception as error:  # noqa: BLE001 - one-shot CLI reports and exits
        print(
            f"scout bootstrap failed: {type(error).__name__}: {error}", file=sys.stderr
        )
        return 1
    print(report.summary())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
