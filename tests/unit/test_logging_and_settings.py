"""Secret redaction in every log line; settings names and validation."""

import io
import logging

import pytest
import structlog

from scout_bff.logging import configure_logging, redact, register_secret
from scout_bff.settings import Settings, placeholder_settings


def test_redact_replaces_registered_secrets_everywhere():
    register_secret("sympera_super-secret-key")
    assert redact("key=sympera_super-secret-key") == "key=[redacted]"
    assert redact({"nested": ["sympera_super-secret-key"]}) == {
        "nested": ["[redacted]"]
    }
    assert redact({"password": "whatever", "fine": 1}) == {
        "password": "[redacted]",
        "fine": 1,
    }
    assert redact({"X-CSRF-Token": "t", "Cookie": "c"}) == {
        "X-CSRF-Token": "[redacted]",
        "Cookie": "[redacted]",
    }


def test_redact_hides_url_credentials_and_header_values():
    assert (
        redact("postgresql+psycopg://app_ui:pw@postgres/article_pipeline")
        == "postgresql+psycopg://[redacted]@postgres/article_pipeline"
    )
    assert redact("x-api-key: sympera_abc") == "x-api-key: [redacted]"
    assert redact("Authorization: Bearer abc.def") == "Authorization: [redacted]"


def test_configured_logging_never_prints_settings_secrets(monkeypatch):
    settings = placeholder_settings(
        pipeline_operator_key="operator-key-SECRET-1",
        pipeline_reader_key="reader-key-SECRET-2",
        session_secret="session-secret-SECRET-3-with-32-chars",
        ui_database_password="db-password-SECRET-4",
        log_format="json",
    )
    configure_logging(settings)
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.getLogger().handlers[0].formatter)
    logging.getLogger().handlers[:] = [handler]
    logger = structlog.get_logger("test")
    logger.info(
        "leak_attempt",
        key="operator-key-SECRET-1",
        url="postgresql+psycopg://app_ui:db-password-SECRET-4@postgres/db",
        headers={"X-API-Key": "reader-key-SECRET-2"},
        note="session-secret-SECRET-3-with-32-chars inline",
    )
    logging.getLogger("plain").warning("plain stdlib line with reader-key-SECRET-2")
    output = stream.getvalue()
    assert "leak_attempt" in output and "plain stdlib line" in output
    for secret in (
        "operator-key-SECRET-1",
        "reader-key-SECRET-2",
        "SECRET-3",
        "db-password-SECRET-4",
    ):
        assert secret not in output, output
    assert '"service": "ui"' in output and '"version": "0.1.0"' in output


def test_settings_read_exact_variable_names(monkeypatch):
    for name, value in {
        "UI_DATABASE_URL": "postgresql://app_ui:pw@db/article_pipeline",
        "UI_DATABASE_PASSWORD": "pw",
        "PIPELINE_API_URL": "http://api:8000/",
        "PIPELINE_OPERATOR_KEY": "op",
        "PIPELINE_READER_KEY": "rd",
        "SESSION_SECRET": "s" * 32,
        "UI_PUBLIC_URL": "https://scout.example.com",
        "UI_SECURE_COOKIES": "false",
        "UI_SESSION_IDLE_HOURS": "6",
        "UI_SESSION_ABSOLUTE_DAYS": "3",
        "UI_BOOTSTRAP_ADMIN_EMAIL": "root@example.com",
        "UI_BOOTSTRAP_ADMIN_PASSWORD": "root-pass-1",
        "UI_AUDIT_RETENTION_DAYS": "30",
        "UI_CAPABILITY_REFRESH_SECONDS": "60",
        "LOG_LEVEL": "debug",
        "LOG_FORMAT": "console",
        "UI_PORT": "9090",
    }.items():
        monkeypatch.setenv(name, value)
    settings = Settings(_env_file=None)
    assert settings.pipeline_api_url == "http://api:8000"
    assert settings.ui_secure_cookies is False
    assert settings.session_idle_seconds == 6 * 3600
    assert settings.session_absolute_seconds == 3 * 86400
    assert settings.ui_audit_retention_days == 30
    assert settings.ui_capability_refresh_seconds == 60
    assert settings.ui_port == 9090
    assert settings.log_format == "console"
    assert settings.pipeline_operator_key.get_secret_value() == "op"
    assert "SecretStr('op')" not in repr(settings)
    assert "root-pass-1" not in repr(settings)


def test_session_secret_must_be_long_enough():
    with pytest.raises(ValueError, match="32"):
        placeholder_settings(session_secret="too-short")


def test_explicit_platform_file_is_read_when_present(tmp_path, monkeypatch):
    env_file = tmp_path / ".env.platform"
    env_file.write_text(
        "UI_DATABASE_URL=postgresql+psycopg://u:p@localhost/db\n"
        "PIPELINE_API_URL=http://localhost:8000\n"
        "PIPELINE_OPERATOR_KEY=op\nPIPELINE_READER_KEY=rd\n"
        f"SESSION_SECRET={'x' * 40}\n"
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PLATFORM_ENV_FILE", str(env_file))
    for name in ("UI_DATABASE_URL", "PIPELINE_API_URL", "SESSION_SECRET"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings()
    assert settings.pipeline_api_url == "http://localhost:8000"
    assert settings.ui_port == 8080
