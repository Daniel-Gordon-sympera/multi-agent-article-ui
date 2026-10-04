"""FastAPI dependencies: current_user, require_role and the password-change gate."""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import Depends, Request

from scout_bff.auth.csrf import check_csrf
from scout_bff.auth.roles import role_satisfies
from scout_bff.auth.sessions import (
    COOKIE_NAME,
    CookieCodec,
    SessionRecord,
    load_session,
    renew_session,
)
from scout_bff.errors import Problem

# Allowed while must_change_password is set (method, path).
PASSWORD_GATE_EXEMPT = frozenset(
    {
        ("GET", "/app/auth/me"),
        ("POST", "/app/auth/password"),
        ("POST", "/app/auth/logout"),
    }
)


@dataclass(frozen=True)
class AuthenticatedUser:
    """What routes receive from `current_user`."""

    id: UUID
    email: str
    name: str
    role: str
    must_change_password: bool
    created_at: datetime
    session_id: str
    csrf_token: str

    def as_json(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "must_change_password": self.must_change_password,
            "created_at": self.created_at.isoformat(),
        }


def cookie_codec(request: Request) -> CookieCodec:
    codec = getattr(request.app.state, "cookie_codec", None)
    if codec is None:
        codec = CookieCodec(request.app.state.settings)
        request.app.state.cookie_codec = codec
    return codec


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def not_authenticated() -> Problem:
    return Problem(401, "not_authenticated", "Sign in to use this resource.")


async def resolve_session(request: Request) -> SessionRecord | None:
    """Load the live session for the request cookie; None when there is none."""
    session_id = cookie_codec(request).decode(request.cookies.get(COOKIE_NAME))
    if session_id is None:
        return None
    engine = request.app.state.engine
    settings = request.app.state.settings
    async with engine.begin() as connection:
        record = await load_session(connection, session_id)
        if record is None or record.disabled_at is not None:
            return None
        await renew_session(connection, settings, record)
    return record


async def current_user(request: Request) -> AuthenticatedUser:
    """Session cookie → user; enforces CSRF and the password-change gate."""
    record = await resolve_session(request)
    if record is None:
        raise not_authenticated()
    request.state.user_id = str(record.user_id)
    request.state.role = record.role
    check_csrf(request.method, request.headers, record.csrf_token)
    if record.must_change_password:
        route = (request.method.upper(), request.url.path)
        if route not in PASSWORD_GATE_EXEMPT:
            raise Problem(
                403,
                "password_change_required",
                "Change your password before using the console.",
            )
    return AuthenticatedUser(
        id=record.user_id,
        email=record.email,
        name=record.name,
        role=record.role,
        must_change_password=record.must_change_password,
        created_at=record.user_created_at,
        session_id=record.id,
        csrf_token=record.csrf_token,
    )


def require_role(
    required: str,
) -> Callable[..., Coroutine[Any, Any, AuthenticatedUser]]:
    """Dependency factory: `Depends(require_role("operator"))`."""

    async def dependency(
        user: AuthenticatedUser = Depends(current_user),
    ) -> AuthenticatedUser:
        if not role_satisfies(user.role, required):
            raise Problem(
                403,
                f"{required}_required",
                f"This action requires the {required} role.",
            )
        return user

    dependency.__name__ = f"require_{required}"
    return dependency
