"""Typed httpx wrapper around the pipeline API for BFF logic (not the proxy)."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from typing import Any, Literal

import httpx

from scout_bff.auth.roles import pipeline_key_for_role
from scout_bff.proxy.client import send_with_retries, timeout_for

KeyRole = Literal["operator", "viewer"]
Page = dict[str, Any]


class PipelineError(Exception):
    """A problem+json answer (or an unusable response) from the pipeline API."""

    def __init__(self, status: int, category: str, detail: str, **extra: Any) -> None:
        super().__init__(f"{status} {category}: {detail}")
        self.status = status
        self.category = category
        self.detail = detail
        self.extra = extra


class PipelineUnavailable(PipelineError):
    """The pipeline API could not be reached (connection error)."""

    def __init__(self, detail: str = "The pipeline API is unavailable.") -> None:
        super().__init__(503, "pipeline_api_unavailable", detail)


class PipelineTimeout(PipelineError):
    """The pipeline API accepted the connection but did not answer in time."""

    def __init__(
        self, detail: str = "The pipeline API did not answer in time."
    ) -> None:
        super().__init__(504, "pipeline_api_timeout", detail)


def problem_from_response(response: httpx.Response) -> PipelineError:
    try:
        body = response.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    category = str(body.get("error_category") or "upstream_error")
    detail = str(
        body.get("detail") or f"The pipeline API answered {response.status_code}."
    )
    extra = {
        key: value
        for key, value in body.items()
        if key
        not in {"type", "title", "status", "detail", "instance", "error_category"}
    }
    return PipelineError(response.status_code, category, detail, **extra)


def clean_params(filters: dict[str, Any]) -> dict[str, Any]:
    """Drop None values; booleans become the API's lower-case spelling."""
    cleaned: dict[str, Any] = {}
    for key, value in filters.items():
        if value is None:
            continue
        cleaned[key] = str(value).lower() if isinstance(value, bool) else value
    return cleaned


class PipelineClient:
    """Helpers raise PipelineError subclasses; callers map them to Problems."""

    def __init__(self, http: httpx.AsyncClient, settings: Any) -> None:
        self.http = http
        self.settings = settings
        self.contract_check: Callable[[], None] | None = None

    def _headers(self, role: KeyRole | None) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if role is not None:
            headers["X-API-Key"] = pipeline_key_for_role(self.settings, role)
        return headers

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
        role: KeyRole | None = "operator",
        accept_statuses: tuple[int, ...] = (),
        check_contract: bool = True,
        stream: bool = False,
    ) -> httpx.Response:
        """Send one request; problem answers raise, connection failures raise."""
        if check_contract and self.contract_check is not None:
            self.contract_check()
        request = self.http.build_request(
            method,
            path,
            params=clean_params(params or {}),
            json=json,
            headers=self._headers(role),
            timeout=timeout_for(path, ""),
        )
        try:
            response = await send_with_retries(self.http, request, stream=stream)
        except (httpx.ConnectError, httpx.ConnectTimeout) as error:
            raise PipelineUnavailable() from error
        except httpx.TimeoutException as error:
            raise PipelineTimeout() from error
        except httpx.HTTPError as error:
            raise PipelineUnavailable(
                f"Pipeline API request failed: {error}"
            ) from error
        if response.is_error and response.status_code not in accept_statuses:
            await response.aread()
            await response.aclose()
            raise problem_from_response(response)
        return response

    async def get_json(
        self, path: str, *, role: KeyRole | None = "operator", **params: Any
    ) -> Any:
        response = await self.request("GET", path, params=params, role=role)
        return response.json()

    async def openapi(self) -> dict[str, Any]:
        response = await self.request(
            "GET", "/openapi.json", role=None, check_contract=False
        )
        return response.json()

    async def readyz(self) -> dict[str, Any]:
        """Returns the readiness body for both 200 and 503 answers."""
        response = await self.request(
            "GET", "/readyz", role=None, accept_statuses=(503,), check_contract=False
        )
        try:
            body = response.json()
        except ValueError:
            body = {}
        if not isinstance(body, dict):
            body = {}
        body.setdefault(
            "status", "ready" if response.status_code == 200 else "not_ready"
        )
        return body

    async def list_jobs(self, *, role: KeyRole = "operator", **filters: Any) -> Page:
        filters.setdefault("order", "created_desc")
        return await self.get_json("/v1/jobs", role=role, **filters)

    async def get_job(self, job_id: str, *, role: KeyRole = "operator") -> dict:
        return await self.get_json(f"/v1/jobs/{job_id}", role=role)

    async def list_job_resource(
        self, job_id: str, resource: str, *, role: KeyRole = "operator", **filters: Any
    ) -> Page:
        return await self.get_json(
            f"/v1/jobs/{job_id}/{resource}", role=role, **filters
        )

    async def list_job_signals(self, job_id: str, **filters: Any) -> Page:
        return await self.list_job_resource(job_id, "signals", **filters)

    async def create_job(self, body: dict[str, Any]) -> dict[str, Any]:
        response = await self.request("POST", "/v1/jobs", json=body)
        return response.json()

    async def cancel_job(self, job_id: str) -> dict[str, Any]:
        response = await self.request("POST", f"/v1/jobs/{job_id}/cancel")
        return response.json()

    async def retry_task(self, task_id: int | str) -> dict[str, Any]:
        response = await self.request("POST", f"/v1/tasks/{task_id}/retry")
        return response.json()

    async def finder_memory(self, **filters: Any) -> Page:
        return await self.get_json("/v1/finder/memory", **filters)

    async def ranking(self, job_id: str, **filters: Any) -> Page:
        return await self.list_job_resource(job_id, "ranking", **filters)

    async def workers(self, **filters: Any) -> Page:
        return await self.get_json("/v1/workers", **filters)

    async def daily_stats(self, **filters: Any) -> Page:
        return await self.get_json("/v1/stats/daily", **filters)

    async def iter_items(
        self,
        path: str,
        *,
        role: KeyRole = "operator",
        max_pages: int | None = None,
        **filters: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """Walk complete keyset results unless a caller asks for a sampled view."""
        after: str | None = None
        if path == "/v1/jobs":
            filters.setdefault("order", "created_desc")
        page_count = 0
        seen_cursors: set[str] = set()
        while max_pages is None or page_count < max_pages:
            page_count += 1
            page = await self.get_json(path, role=role, after=after, **filters)
            for item in page.get("items", []):
                yield item
            after = page.get("next_cursor")
            if not after:
                return
            if after in seen_cursors:
                raise PipelineError(502, "invalid_upstream_cursor", "Cursor repeated.")
            seen_cursors.add(after)
