"""structlog configuration, recursive secret redaction and request logging."""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote, quote_plus

import structlog

from scout_bff.version import __version__

_SECRETS: set[str] = set()
_SENSITIVE = re.compile(
    r"password|secret|authorization|api.?key|access.?key|credential|cookie|csrf",
    re.I,
)
_URL_AUTH = re.compile(r"((?:https?|postgres(?:ql)?(?:\+psycopg)?|wss?)://)[^/@\s]+@")
_HEADER_AUTH = re.compile(
    r"((?:authorization|x-api-key|api_key|password|session_secret|x-csrf-token)"
    r"\s*[=:]\s*)(?:(?:Bearer|Basic)\s+)?[^\s,;]+",
    re.I,
)
_QUIET_PATHS = {"/healthz", "/readyz"}


def register_secret(value: str | None) -> None:
    """Remember a secret so every rendered log line replaces it."""
    if value:
        _SECRETS.update((value, quote(value, safe=""), quote_plus(value)))


def redact(value: Any) -> Any:
    """Also used for audit targets and problem details that may echo input."""
    if isinstance(value, Mapping):
        return {
            str(key): "[redacted]" if _SENSITIVE.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, (tuple, list)):
        return [redact(item) for item in value]
    if not isinstance(value, str):
        return value
    value = _URL_AUTH.sub(r"\1[redacted]@", value)
    value = _HEADER_AUTH.sub(r"\1[redacted]", value)
    secrets = _SECRETS | {
        secret
        for name, secret in os.environ.items()
        if _SENSITIVE.search(name) and secret
    }
    for secret in sorted(secrets, key=len, reverse=True):
        value = value.replace(secret, "[redacted]")
    return value


def redact_processor(logger: Any, method: str, event_dict: dict) -> dict:
    return redact(event_dict)


def configure_logging(settings: Any) -> None:
    """Install the JSON/console renderer with the backend's field names."""
    for name in (
        "pipeline_operator_key",
        "pipeline_reader_key",
        "session_secret",
        "ui_database_password",
        "ui_bootstrap_admin_password",
    ):
        secret = getattr(settings, name, None)
        if secret is not None and secret.get_secret_value():
            register_secret(secret.get_secret_value())

    def identity(logger: Any, method: str, event: dict) -> dict:
        event.setdefault("service", "ui")
        event.setdefault("version", __version__)
        return event

    shared = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="ts"),
        identity,
    ]
    renderer = (
        structlog.processors.JSONRenderer()
        if settings.log_format == "json"
        else structlog.dev.ConsoleRenderer(colors=False)
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.format_exc_info,
            redact_processor,
            renderer,
        ],
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(settings.log_level.upper())
    structlog.configure(
        processors=[*shared, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )
    for name in ("httpx", "httpcore", "uvicorn.access", "alembic"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> Any:
    return structlog.get_logger(name)


class RequestLoggingMiddleware:
    """Pure ASGI middleware: one line per request with the contract's fields."""

    def __init__(self, app: Any) -> None:
        self.app = app
        self.logger = structlog.get_logger("scout_bff.http")

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid.uuid4().hex
        state = scope.setdefault("state", {})
        state["request_id"] = request_id
        started = time.perf_counter()
        status_holder = {"status": None}

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        with structlog.contextvars.bound_contextvars(request_id=request_id):
            try:
                await self.app(scope, receive, send_wrapper)
            finally:
                duration_ms = int((time.perf_counter() - started) * 1000)
                path = scope.get("path", "")
                log = self.logger.debug if path in _QUIET_PATHS else self.logger.info
                log(
                    "http_request",
                    user_id=state.get("user_id"),
                    role=state.get("role"),
                    method=scope.get("method"),
                    path=path,
                    status=status_holder["status"],
                    duration_ms=duration_ms,
                )
