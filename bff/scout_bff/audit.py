"""ui.audit_log writer: one row per unsafe /app or /v1 call, after the response."""

from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from scout_bff.auth.csrf import is_unsafe
from scout_bff.logging import get_logger, redact

logger = get_logger("scout_bff.audit")
AUDITED_PREFIXES = ("/app/", "/v1/")


def is_audited(method: str, path: str) -> bool:
    return is_unsafe(method) and path.startswith(AUDITED_PREFIXES)


def audit_target(scope: dict) -> dict[str, Any] | None:
    """Routes may set request.state.audit_target; path parameters otherwise."""
    state = scope.get("state") or {}
    target = state.get("audit_target")
    if target is None:
        target = scope.get("path_params") or None
    if target is None:
        return None
    return redact({str(key): value for key, value in dict(target).items()})


async def write_audit_row(
    engine: AsyncEngine,
    *,
    user_id: str | None,
    role: str | None,
    method: str,
    path: str,
    target: dict[str, Any] | None,
    status: int | None,
    duration_ms: int,
) -> None:
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO ui.audit_log(user_id, role, method, path, target, status, "
                "duration_ms) VALUES (CAST(:user_id AS uuid), :role, :method, :path, "
                "CAST(:target AS jsonb), :status, :duration_ms)"
            ),
            {
                "user_id": user_id,
                "role": role,
                "method": method,
                "path": path,
                "target": json.dumps(target, default=str) if target else None,
                "status": status,
                "duration_ms": duration_ms,
            },
        )


class AuditMiddleware:
    """Pure ASGI middleware; a failing insert is logged and never fails a call."""

    def __init__(self, app: Any, engine: AsyncEngine) -> None:
        self.app = app
        self.engine = engine

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http" or not is_audited(scope["method"], scope["path"]):
            await self.app(scope, receive, send)
            return
        started = time.perf_counter()
        status_holder: dict[str, int | None] = {"status": None}

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            state = scope.get("state") or {}
            try:
                await write_audit_row(
                    self.engine,
                    user_id=state.get("user_id"),
                    role=state.get("role"),
                    method=scope["method"],
                    path=scope["path"],
                    target=audit_target(scope),
                    status=status_holder["status"],
                    duration_ms=int((time.perf_counter() - started) * 1000),
                )
            except Exception as error:  # noqa: BLE001 - auditing must not break calls
                logger.warning("audit_write_failed", error=type(error).__name__)
