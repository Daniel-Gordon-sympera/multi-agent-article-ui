"""CSRF defence: the custom header on every unsafe call plus the session token."""

from __future__ import annotations

import hmac
from collections.abc import Mapping

from fastapi import Request

from scout_bff.errors import Problem

REQUESTED_WITH_HEADER = "X-Requested-With"
REQUESTED_WITH_VALUE = "scout"
CSRF_TOKEN_HEADER = "X-CSRF-Token"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def is_unsafe(method: str) -> bool:
    return method.upper() in UNSAFE_METHODS


def has_requested_with(headers: Mapping[str, str]) -> bool:
    return headers.get(REQUESTED_WITH_HEADER, "").strip() == REQUESTED_WITH_VALUE


def csrf_token_matches(headers: Mapping[str, str], expected: str) -> bool:
    supplied = headers.get(CSRF_TOKEN_HEADER, "")
    return bool(supplied) and hmac.compare_digest(supplied, expected)


def check_csrf(method: str, headers: Mapping[str, str], csrf_token: str) -> None:
    """Raise 403 csrf_failed for an unsafe request without both headers."""
    if not is_unsafe(method):
        return
    if not has_requested_with(headers):
        raise Problem(
            403,
            "csrf_failed",
            f"Unsafe requests need the header {REQUESTED_WITH_HEADER}: "
            f"{REQUESTED_WITH_VALUE}.",
        )
    if not csrf_token_matches(headers, csrf_token):
        raise Problem(
            403,
            "csrf_failed",
            f"Unsafe requests need the session's token in {CSRF_TOKEN_HEADER}.",
        )


async def require_requested_with(request: Request) -> None:
    """Dependency for POST /app/auth/login, which has no session token yet."""
    if not has_requested_with(request.headers):
        raise Problem(
            403,
            "csrf_failed",
            f"This request needs the header {REQUESTED_WITH_HEADER}: "
            f"{REQUESTED_WITH_VALUE}.",
        )
