"""One httpx.AsyncClient for the pipeline API, with the contract's timeouts."""

from __future__ import annotations

import re
from typing import Any

import httpx

CONNECT_TIMEOUT = 5.0
JSON_READ_TIMEOUT = 30.0
GET_RETRIES = 3
JSON_TIMEOUT = httpx.Timeout(
    connect=CONNECT_TIMEOUT, read=JSON_READ_TIMEOUT, write=30.0, pool=CONNECT_TIMEOUT
)
STREAM_TIMEOUT = httpx.Timeout(
    connect=CONNECT_TIMEOUT, read=None, write=30.0, pool=CONNECT_TIMEOUT
)
LIMITS = httpx.Limits(max_connections=50, max_keepalive_connections=20)

_STREAMED_PATH = re.compile(
    r"^/v1/(?:jobs/[^/]+/export/[^/]+\.csv|artifacts/[^/]+/[^/]+)$"
)
_ARTICLE_PATH = re.compile(r"^/v1/articles/[^/]+$")
_INCLUDE_TEXT = re.compile(r"(?:^|&)include=text(?:&|$)")


def create_pipeline_http_client(settings: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.pipeline_api_url,
        timeout=JSON_TIMEOUT,
        limits=LIMITS,
        follow_redirects=False,
        headers={"Accept-Encoding": "identity"},
    )


def is_streamed(path: str, query: str) -> bool:
    """CSV exports, artifacts and saved article text get no read timeout."""
    if _STREAMED_PATH.match(path):
        return True
    return bool(_ARTICLE_PATH.match(path) and _INCLUDE_TEXT.search(query or ""))


def timeout_for(path: str, query: str) -> httpx.Timeout:
    return STREAM_TIMEOUT if is_streamed(path, query) else JSON_TIMEOUT


def is_connection_error(error: Exception) -> bool:
    return isinstance(error, (httpx.ConnectError, httpx.ConnectTimeout))


async def send_with_retries(
    client: httpx.AsyncClient, request: httpx.Request, *, stream: bool = False
) -> httpx.Response:
    """GET requests retry connection errors up to GET_RETRIES attempts."""
    attempts = GET_RETRIES if request.method == "GET" else 1
    for attempt in range(1, attempts + 1):
        try:
            return await client.send(request, stream=stream)
        except (httpx.ConnectError, httpx.ConnectTimeout):
            if attempt == attempts:
                raise
    raise AssertionError("unreachable")
