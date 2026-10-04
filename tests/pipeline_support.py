"""Helpers shared by the stub pipeline API modules: problems, cursors, filters."""

from __future__ import annotations

import base64
import json
from typing import Any

import httpx

JOB_FILTERS = {
    "status": "status",
    "county": "county",
    "state": "state_code",
    "created_after": "created_at",
    "created_before": "created_at",
}
TASK_FILTERS = {"status": "status", "kind": "kind", "created_after": "created_at"}
SIGNAL_FILTERS = {
    "signal": "signal",
    "materiality": "materiality",
    "company_key": "company_key",
    "hq_scope": "hq_scope",
    "org_kind": "org_kind",
}


def problem(
    request: httpx.Request, status: int, category: str, detail: str, **extra: Any
) -> httpx.Response:
    titles = {401: "Authentication required", 403: "Forbidden", 404: "Not found"}
    return httpx.Response(
        status,
        headers={"content-type": "application/problem+json"},
        json={
            "type": f"urn:sympera:problem:{category}",
            "title": titles.get(status, "Request failed"),
            "status": status,
            "detail": detail,
            "instance": request.url.path,
            "error_category": category,
            **extra,
        },
    )


def encode_cursor(scope: str, key: str) -> str:
    raw = json.dumps({"v": 1, "scope": scope, "key": key}).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict[str, Any]:
    padded = cursor + "=" * (-len(cursor) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))
