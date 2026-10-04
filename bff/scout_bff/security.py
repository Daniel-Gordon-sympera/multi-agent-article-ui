"""Security headers (contract §4.9) on every response, as pure ASGI middleware."""

from __future__ import annotations

from typing import Any

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; img-src 'self' data:; "
    "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
# Swagger UI and ReDoc load their assets from jsdelivr; only those two pages relax
# the script/style sources. Everything else gets the contract's strict policy.
DOCS_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "font-src 'self' https://fonts.gstatic.com; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
DOCS_PATHS = frozenset({"/docs", "/redoc", "/docs/oauth2-redirect"})

SECURITY_HEADERS: tuple[tuple[str, str], ...] = (
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "same-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
    ("X-Frame-Options", "DENY"),
)


def security_headers_for(path: str) -> list[tuple[bytes, bytes]]:
    policy = (
        DOCS_CONTENT_SECURITY_POLICY if path in DOCS_PATHS else CONTENT_SECURITY_POLICY
    )
    headers = [(b"content-security-policy", policy.encode())]
    headers.extend(
        (name.lower().encode(), value.encode()) for name, value in SECURITY_HEADERS
    )
    return headers


class SecurityHeadersMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        extra = security_headers_for(scope.get("path", ""))
        names = {name for name, _ in extra}

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() not in names
                ]
                headers.extend(extra)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
