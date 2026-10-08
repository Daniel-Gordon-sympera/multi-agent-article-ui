"""ANY /v1/{path}: allowlisted, role-keyed, streaming passthrough to the pipeline."""

from __future__ import annotations

import time

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.auth.roles import pipeline_key_for_role
from scout_bff.errors import Problem
from scout_bff.logging import get_logger
from scout_bff.proxy.allowlist import match_rule, role_allowed
from scout_bff.proxy.client import send_with_retries, timeout_for

router = APIRouter(tags=["proxy"])
logger = get_logger("scout_bff.proxy")

FORWARDED_REQUEST_HEADERS = ("accept", "content-type", "if-none-match")
PASSED_RESPONSE_HEADERS = (
    "content-type",
    "etag",
    "cache-control",
    "content-disposition",
    "content-length",
)
BODYLESS_STATUSES = frozenset({204, 304})
METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


def upstream_headers(request: Request, api_key: str) -> dict[str, str]:
    """Only the contract's headers go upstream; cookies and keys never do."""
    headers = {"Accept-Encoding": "identity", "X-API-Key": api_key}
    for name in FORWARDED_REQUEST_HEADERS:
        value = request.headers.get(name)
        if value:
            headers[name] = value
    return headers


def passthrough_headers(upstream: httpx.Response) -> dict[str, str]:
    headers = {
        name: upstream.headers[name]
        for name in PASSED_RESPONSE_HEADERS
        if name in upstream.headers
    }
    if "content-encoding" in upstream.headers:
        # We asked for identity; if the API compressed anyway, httpx decodes
        # the body, so the upstream length no longer applies.
        headers.pop("content-length", None)
    return headers


def upstream_problem(error: Exception) -> Problem:
    if isinstance(error, (httpx.ConnectError, httpx.ConnectTimeout)):
        return Problem(
            503, "pipeline_api_unavailable", "The pipeline API is unavailable."
        )
    if isinstance(error, httpx.TimeoutException):
        return Problem(
            504, "pipeline_api_timeout", "The pipeline API did not answer in time."
        )
    return Problem(503, "pipeline_api_unavailable", "The pipeline API request failed.")


async def proxy(
    request: Request,
    path: str,
    user: AuthenticatedUser = Depends(current_user),
) -> Response:
    """Reverse proxy: see engineering contract §4.7 for the exact policy."""
    upstream_path = f"/v1/{path}"
    request.state.audit_target = {"path": upstream_path}
    rule = match_rule(request.method, upstream_path)
    if rule is None:
        raise Problem(
            404, "not_proxied", "This pipeline API route is not available here."
        )
    if not role_allowed(rule, user.role):
        raise Problem(
            403,
            f"{rule.min_role}_required",
            f"This action requires the {rule.min_role} role.",
        )
    request.app.state.capabilities.require_compatible()
    settings = request.app.state.settings
    client: httpx.AsyncClient = request.app.state.http
    query = request.url.query
    url = upstream_path + (f"?{query}" if query else "")
    body = await request.body() if request.method != "GET" else None
    upstream_request = client.build_request(
        request.method,
        url,
        content=body,
        headers=upstream_headers(request, pipeline_key_for_role(settings, user.role)),
        timeout=timeout_for(upstream_path, query),
    )
    started = time.perf_counter()
    try:
        upstream = await send_with_retries(client, upstream_request, stream=True)
    except httpx.HTTPError as error:
        problem = upstream_problem(error)
        logger.warning(
            "proxy_call",
            user_id=str(user.id),
            role=user.role,
            method=request.method,
            path=upstream_path,
            status=problem.status_code,
            duration_ms=int((time.perf_counter() - started) * 1000),
            error=type(error).__name__,
        )
        raise problem from None
    logger.info(
        "proxy_call",
        user_id=str(user.id),
        role=user.role,
        method=request.method,
        path=upstream_path,
        status=upstream.status_code,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    headers = passthrough_headers(upstream)
    if upstream.status_code in BODYLESS_STATUSES:
        await upstream.aclose()
        headers.pop("content-length", None)
        return Response(status_code=upstream.status_code, headers=headers)
    return StreamingResponse(
        upstream.aiter_bytes(),
        status_code=upstream.status_code,
        headers=headers,
        background=BackgroundTask(upstream.aclose),
    )


for _method in METHODS:
    router.add_api_route(
        "/v1/{path:path}",
        proxy,
        methods=[_method],
        operation_id=f"proxy_{_method.lower()}",
        summary=f"{_method} passthrough to the pipeline API (allowlisted, by role)",
    )
