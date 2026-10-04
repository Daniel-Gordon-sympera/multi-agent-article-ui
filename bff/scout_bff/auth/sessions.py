"""Server-side sessions: signed cookie value, rows in ui.sessions, expiry rules."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

COOKIE_NAME = "scout_session"
COOKIE_SALT = "scout_session"
RENEWAL_INTERVAL = timedelta(seconds=60)


@dataclass(frozen=True)
class SessionRecord:
    """A session row joined with the user it belongs to."""

    id: str
    csrf_token: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    user_id: UUID
    email: str
    name: str
    role: str
    must_change_password: bool
    user_created_at: datetime
    disabled_at: datetime | None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_session_id() -> str:
    return secrets.token_urlsafe(32)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


class CookieCodec:
    """Signs the session id so a tampered cookie never reaches the database."""

    def __init__(self, settings: Any) -> None:
        self.serializer = URLSafeTimedSerializer(
            settings.session_secret.get_secret_value(), salt=COOKIE_SALT
        )
        self.max_age = settings.session_absolute_seconds
        self.secure = bool(settings.ui_secure_cookies)

    def encode(self, session_id: str) -> str:
        return self.serializer.dumps(session_id)

    def decode(self, value: str | None) -> str | None:
        if not value:
            return None
        try:
            session_id = self.serializer.loads(value, max_age=self.max_age)
        except BadSignature:
            return None
        return session_id if isinstance(session_id, str) else None

    def set_cookie(self, response: Response, session_id: str) -> None:
        response.set_cookie(
            COOKIE_NAME,
            self.encode(session_id),
            max_age=self.max_age,
            path="/",
            httponly=True,
            secure=self.secure,
            samesite="lax",
        )

    def clear_cookie(self, response: Response) -> None:
        response.delete_cookie(
            COOKIE_NAME, path="/", httponly=True, secure=self.secure, samesite="lax"
        )


def session_expiry(created_at: datetime, now: datetime, settings: Any) -> datetime:
    """Idle expiry slides with activity; the absolute limit never moves."""
    idle = now + timedelta(seconds=settings.session_idle_seconds)
    absolute = created_at + timedelta(seconds=settings.session_absolute_seconds)
    return min(idle, absolute)


async def create_session(
    connection: AsyncConnection,
    settings: Any,
    user_id: UUID,
    *,
    ip: str | None,
    user_agent: str | None,
) -> tuple[str, str]:
    """Insert a session row; returns (session_id, csrf_token)."""
    session_id, csrf_token = new_session_id(), new_csrf_token()
    now = utc_now()
    await connection.execute(
        text(
            "INSERT INTO ui.sessions(id, user_id, csrf_token, created_at, "
            "last_seen_at, expires_at, user_agent, ip) VALUES (:id, :user_id, "
            ":csrf_token, :now, :now, :expires_at, :user_agent, :ip)"
        ),
        {
            "id": session_id,
            "user_id": user_id,
            "csrf_token": csrf_token,
            "now": now,
            "expires_at": session_expiry(now, now, settings),
            "user_agent": (user_agent or "")[:512] or None,
            "ip": ip,
        },
    )
    return session_id, csrf_token


async def load_session(
    connection: AsyncConnection, session_id: str
) -> SessionRecord | None:
    """Return the live session with its user, or None when unknown or expired."""
    result = await connection.execute(
        text(
            "SELECT s.id, s.csrf_token, s.created_at, s.last_seen_at, s.expires_at, "
            "u.id AS user_id, u.email::text AS email, u.name, u.role, "
            "u.must_change_password, u.created_at AS user_created_at, u.disabled_at "
            "FROM ui.sessions s JOIN ui.users u ON u.id = s.user_id "
            "WHERE s.id = :id AND s.expires_at > now()"
        ),
        {"id": session_id},
    )
    row = result.mappings().first()
    return SessionRecord(**row) if row else None


async def renew_session(
    connection: AsyncConnection, settings: Any, record: SessionRecord
) -> None:
    """Slide the idle expiry at most once a minute to keep writes cheap."""
    now = utc_now()
    if now - record.last_seen_at < RENEWAL_INTERVAL:
        return
    await connection.execute(
        text(
            "UPDATE ui.sessions SET last_seen_at = :now, expires_at = :expires_at "
            "WHERE id = :id"
        ),
        {
            "id": record.id,
            "now": now,
            "expires_at": session_expiry(record.created_at, now, settings),
        },
    )


async def delete_session(connection: AsyncConnection, session_id: str) -> None:
    await connection.execute(
        text("DELETE FROM ui.sessions WHERE id = :id"), {"id": session_id}
    )


async def delete_user_sessions(
    connection: AsyncConnection, user_id: UUID, *, keep: str | None = None
) -> int:
    """Sign a user out everywhere, optionally keeping one session (the caller's)."""
    result = await connection.execute(
        text(
            "DELETE FROM ui.sessions WHERE user_id = :user_id "
            "AND (CAST(:keep AS text) IS NULL OR id <> :keep)"
        ),
        {"user_id": user_id, "keep": keep},
    )
    return result.rowcount or 0
