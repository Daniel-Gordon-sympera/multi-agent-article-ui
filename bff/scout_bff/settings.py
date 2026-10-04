"""Environment settings with the exact variable names of the engineering contract."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MINIMUM_SESSION_SECRET_LENGTH = 32


class Settings(BaseSettings):
    """Settings read from the environment and from `.env.ui` when present."""

    model_config = SettingsConfigDict(
        env_file=".env.ui",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    ui_database_url: str
    ui_database_password: SecretStr = SecretStr("")
    pipeline_api_url: str
    pipeline_operator_key: SecretStr
    pipeline_reader_key: SecretStr
    session_secret: SecretStr
    ui_public_url: str = "http://localhost:8080"
    ui_secure_cookies: bool = True
    ui_session_idle_hours: int = Field(default=12, ge=1)
    ui_session_absolute_days: int = Field(default=7, ge=1)
    ui_bootstrap_admin_email: str = ""
    ui_bootstrap_admin_password: SecretStr = SecretStr("")
    ui_audit_retention_days: int = Field(default=180, ge=1)
    ui_capability_refresh_seconds: int = Field(default=300, ge=5)
    ui_port: int = Field(default=8080, ge=1, le=65535)
    ui_db_pool_size: int = Field(default=5, ge=1, le=64)
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    @field_validator("session_secret")
    @classmethod
    def session_secret_long_enough(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < MINIMUM_SESSION_SECRET_LENGTH:
            raise ValueError(
                f"SESSION_SECRET must have at least {MINIMUM_SESSION_SECRET_LENGTH} "
                "characters."
            )
        return value

    @field_validator("pipeline_api_url", "ui_public_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def session_idle_seconds(self) -> int:
        return self.ui_session_idle_hours * 3600

    @property
    def session_absolute_seconds(self) -> int:
        return self.ui_session_absolute_days * 86400


def placeholder_settings(**overrides: object) -> Settings:
    """Settings that need no environment, for OpenAPI export and unit tests."""
    values: dict[str, object] = {
        "ui_database_url": "postgresql+psycopg://app_ui:placeholder@localhost/scout",
        "pipeline_api_url": "http://pipeline-api.invalid:8000",
        "pipeline_operator_key": "placeholder-operator-key",
        "pipeline_reader_key": "placeholder-reader-key",
        "session_secret": "placeholder-session-secret-of-32-chars!",
        "ui_secure_cookies": False,
        "log_format": "console",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]
