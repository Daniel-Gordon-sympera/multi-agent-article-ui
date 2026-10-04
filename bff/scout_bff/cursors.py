"""Opaque, query-bound cursors for BFF-side pagination (same scheme as the API)."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from scout_bff.errors import Problem

MAX_CURSOR_LENGTH = 8192


def cursor_scope(name: str, parameters: Any) -> str:
    """Bind a cursor to a resource and its filters so it cannot be reused elsewhere."""
    source = json.dumps([name, parameters], sort_keys=True, default=str)
    return hashlib.sha256(source.encode()).hexdigest()[:24]


def encode_cursor(scope: str, value: str) -> str:
    raw = json.dumps({"v": 1, "scope": scope, "key": value}).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str, scope: str) -> str:
    """Raise 400 invalid_cursor on tampering, truncation or a different query."""
    try:
        if len(cursor) > MAX_CURSOR_LENGTH:
            raise ValueError("cursor too long")
        data = json.loads(
            base64.b64decode(
                cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True
            )
        )
        if data["v"] != 1 or data["scope"] != scope or not isinstance(data["key"], str):
            raise ValueError("cursor mismatch")
        return data["key"]
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise Problem(
            400, "invalid_cursor", "The cursor is invalid for this query."
        ) from None


def encode_offset_cursor(scope: str, offset: int) -> str:
    return encode_cursor(scope, str(offset))


def decode_offset_cursor(cursor: str | None, scope: str) -> int:
    if not cursor:
        return 0
    value = decode_cursor(cursor, scope)
    if not value.isdigit():
        raise Problem(400, "invalid_cursor", "The cursor is invalid for this query.")
    return int(value)
