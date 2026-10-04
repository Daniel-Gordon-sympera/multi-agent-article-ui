"""Bootstrap from empty and re-run; roles, grants, Alembic head and downgrade."""

import pytest
from sqlalchemy import create_engine, text

from scout_bff.auth.passwords import verify_password
from scout_bff.bootstrap import current_revision, run_alembic, run_bootstrap
from scout_bff.db import MIGRATION_HEAD, database_url, migrations_current
from scout_bff.settings import Settings
from tests.conftest import (
    APP_UI_PASSWORD,
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
    build_settings,
    fetch_all,
)

EXPECTED_TABLES = {
    "alembic_version",
    "users",
    "sessions",
    "login_attempts",
    "scouts",
    "batches",
    "batch_jobs",
    "sources",
    "saved_views",
    "preferences",
    "audit_log",
    "dismissed_suggestions",
}


@pytest.fixture
def owner_engine(test_settings: Settings):
    engine = create_engine(database_url(test_settings.ui_database_url))
    yield engine
    engine.dispose()


def test_session_bootstrap_created_everything(bootstrapped_database, owner_engine):
    report = bootstrapped_database
    assert report.migration_after == MIGRATION_HEAD
    assert report.migration_before is None
    assert report.admin_created is True
    assert "created" in report.summary()
    with owner_engine.connect() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'ui'")
            )
        }
        assert tables == EXPECTED_TABLES
        owner = connection.scalar(
            text(
                "SELECT pg_get_userbyid(nspowner) FROM pg_namespace "
                "WHERE nspname = 'ui'"
            )
        )
        assert owner == "svc_ui"
        roles = {
            row[0]: row[1]
            for row in connection.execute(
                text(
                    "SELECT rolname, rolcanlogin FROM pg_roles "
                    "WHERE rolname IN ('svc_ui', 'app_ui')"
                )
            )
        }
        assert roles == {"svc_ui": False, "app_ui": True}
        assert connection.scalar(
            text("SELECT pg_has_role('app_ui', 'svc_ui', 'MEMBER')")
        )
        assert (
            connection.scalar(text("SELECT to_regclass('public.alembic_version')"))
            is None
        )


def test_app_ui_login_role_can_use_the_schema_and_nothing_else(test_settings):
    url = database_url(test_settings.ui_database_url).set(
        username="app_ui", password=APP_UI_PASSWORD
    )
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO ui.login_attempts(key) VALUES ('t')"))
            connection.execute(text("DELETE FROM ui.login_attempts WHERE key = 't'"))
            assert (
                connection.scalar(text("SELECT version_num FROM ui.alembic_version"))
                == MIGRATION_HEAD
            )
            assert connection.scalar(text("SELECT count(*) FROM ui.audit_log")) >= 0
            assert not connection.scalar(
                text("SELECT has_schema_privilege('app_ui', 'public', 'CREATE')")
            )
    finally:
        engine.dispose()


async def test_rerun_is_idempotent_and_recreates_admin_when_users_empty(
    engine, test_settings, owner_engine
):
    report = run_bootstrap(test_settings, owner_engine)
    assert report.migration_before == MIGRATION_HEAD
    assert report.migration_after == MIGRATION_HEAD
    assert report.admin_created is True  # the engine fixture truncated ui.users
    rows = await fetch_all(engine, "SELECT * FROM ui.users")
    assert len(rows) == 1
    admin = rows[0]
    assert admin["email"] == BOOTSTRAP_ADMIN_EMAIL
    assert admin["role"] == "admin"
    assert admin["must_change_password"] is True
    assert verify_password(admin["password_hash"], BOOTSTRAP_ADMIN_PASSWORD)
    again = run_bootstrap(test_settings, owner_engine)
    assert again.admin_created is False
    assert "skipped (1 account(s) exist)" in again.summary()
    assert len(await fetch_all(engine, "SELECT id FROM ui.users")) == 1
    assert await migrations_current(engine)


def test_bootstrap_without_admin_variables_skips_the_admin(owner_engine):
    with owner_engine.begin() as connection:
        connection.execute(text("DELETE FROM ui.users"))
    settings = build_settings(
        ui_bootstrap_admin_email="", ui_bootstrap_admin_password=""
    )
    report = run_bootstrap(settings, owner_engine)
    assert report.admin_created is False
    assert "UI_BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set" in report.summary()


def test_bootstrap_rejects_a_weak_admin_password(owner_engine):
    with owner_engine.begin() as connection:
        connection.execute(text("DELETE FROM ui.users"))
    settings = build_settings(ui_bootstrap_admin_password="short")
    with pytest.raises(ValueError, match="at least 8"):
        run_bootstrap(settings, owner_engine)


def test_alembic_downgrade_base_then_upgrade_head(owner_engine, test_settings):
    with owner_engine.begin() as connection:
        run_alembic(connection, "downgrade", "base")
        assert current_revision(connection) is None
        tables = {
            row[0]
            for row in connection.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'ui'")
            )
        }
        assert tables == {"alembic_version"}
    with owner_engine.begin() as connection:
        run_alembic(connection, "upgrade", "head")
        assert current_revision(connection) == MIGRATION_HEAD
    # Re-running the full bootstrap restores grants and the admin afterwards.
    report = run_bootstrap(test_settings, owner_engine)
    assert report.migration_after == MIGRATION_HEAD
