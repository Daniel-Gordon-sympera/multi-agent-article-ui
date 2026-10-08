"""Verify the required pipeline contract and both configured key roles."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request

from scout_bff.auth.deps import current_user
from scout_bff.logging import get_logger
from scout_bff.pipeline_client import PipelineClient, PipelineError
from scout_bff.pipeline_contract import CONTRACT_VERSION, contract_errors

logger = get_logger("scout_bff.capabilities")

# capability → (method, path template). Path parameters compare by position only.
CAPABILITY_ROUTES: dict[str, tuple[str, str]] = {
    "signals_global": ("get", "/v1/signals"),
    "tasks_global": ("get", "/v1/tasks"),
    "retry_dead": ("post", "/v1/jobs/{job_id}/retry-dead"),
    "api_keys_list": ("get", "/v1/api-keys"),
    "sources_stats": ("get", "/v1/sources/stats"),
    "cost_estimate": ("get", "/v1/stats/cost-estimate"),
}
# capability → query parameter that GET /v1/jobs must declare.
JOBS_FILTER_CAPABILITIES: dict[str, str] = {
    "jobs_industry_filter": "industry",
    "jobs_reference_filter": "client_reference_prefix",
}
CAPABILITY_NAMES: tuple[str, ...] = (
    *CAPABILITY_ROUTES,
    *JOBS_FILTER_CAPABILITIES,
)
_PATH_PARAMETER = re.compile(r"\{[^}]*\}")


def _normalise_path(path: str) -> str:
    return _PATH_PARAMETER.sub("{}", path.rstrip("/"))


def all_false() -> dict[str, bool]:
    return {name: False for name in CAPABILITY_NAMES}


def _query_parameters(operation: dict[str, Any], path_item: dict[str, Any]) -> set:
    names = set()
    for parameter in [
        *path_item.get("parameters", []),
        *operation.get("parameters", []),
    ]:
        if isinstance(parameter, dict) and parameter.get("in") == "query":
            names.add(parameter.get("name"))
    return names


def derive_capabilities(document: dict[str, Any]) -> dict[str, bool]:
    """Pure function: an OpenAPI document → the capability map of contract §4.6."""
    paths = document.get("paths") or {}
    operations: dict[tuple[str, str], tuple[dict, dict]] = {}
    for raw_path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if isinstance(operation, dict) and method.lower() in {
                "get",
                "post",
                "put",
                "patch",
                "delete",
            }:
                key = (method.lower(), _normalise_path(raw_path))
                operations[key] = (operation, path_item)
    capabilities = {
        name: (method, _normalise_path(path)) in operations
        for name, (method, path) in CAPABILITY_ROUTES.items()
    }
    jobs = operations.get(("get", "/v1/jobs"))
    jobs_query = _query_parameters(*jobs) if jobs else set()
    for name, parameter in JOBS_FILTER_CAPABILITIES.items():
        capabilities[name] = parameter in jobs_query
    return capabilities


class CapabilityCache:
    """Last probe result; refreshed in the background and on demand."""

    def __init__(self, pipeline: PipelineClient, refresh_seconds: int) -> None:
        self.pipeline = pipeline
        self.refresh_seconds = refresh_seconds
        self.capabilities: dict[str, bool] = all_false()
        self.probed_at: datetime | None = None
        self.probe_error: str | None = "not probed yet"
        self.pipeline_api_version: str | None = None
        self.contract_version: int | None = None
        self.contract_errors: list[str] = ["Pipeline contract has not been checked."]
        self.compatible = False
        self.keys_valid = False
        self.api_ready: bool = False
        self.api_checks: dict[str, Any] = {}
        self.api_checked_at: datetime | None = None
        self._lock = asyncio.Lock()

    async def probe(self) -> None:
        """Fetch /openapi.json and /readyz; never raises."""
        async with self._lock:
            try:
                document = await self.pipeline.openapi()
                self.capabilities = derive_capabilities(document)
                self.pipeline_api_version = (document.get("info") or {}).get("version")
                self.contract_version = document.get("x-scout-contract-version")
                self.contract_errors = contract_errors(document)
                self.compatible = not self.contract_errors
                self.probe_error = None
            except (PipelineError, ValueError, TypeError) as error:
                self.capabilities = all_false()
                self.compatible = False
                self.contract_errors = ["Pipeline contract could not be read."]
                self.probe_error = str(error)
                logger.warning("capability_probe_failed", error=str(error))
            self.probed_at = datetime.now(timezone.utc)
            await self._check_keys()
            await self._check_ready()

    def require_compatible(self) -> None:
        if not self.compatible:
            raise PipelineError(
                503,
                "pipeline_contract_incompatible",
                "Install matching UI and pipeline releases. "
                + " ".join(self.contract_errors),
            )
        if not self.keys_valid:
            raise PipelineError(
                503,
                "pipeline_keys_invalid",
                "Configure valid, separate pipeline reader and operator keys.",
            )

    async def _check_keys(self) -> None:
        self.keys_valid = False
        try:
            await self.pipeline.request(
                "GET",
                "/v1/jobs",
                role="viewer",
                params={"limit": 1},
                check_contract=False,
            )
            await self.pipeline.request(
                "GET",
                "/v1/api-keys",
                role="operator",
                params={"limit": 1},
                check_contract=False,
            )
            denied = await self.pipeline.request(
                "GET",
                "/v1/api-keys",
                role="viewer",
                params={"limit": 1},
                check_contract=False,
                accept_statuses=(403,),
            )
            self.keys_valid = denied.status_code == 403
        except PipelineError:
            self.keys_valid = False

    async def _check_ready(self) -> None:
        try:
            body = await self.pipeline.readyz()
            self.api_ready = (
                body.get("status") == "ready" and self.compatible and self.keys_valid
            )
            self.api_checks = dict(body.get("checks") or {})
            self.api_checks.update(contract=self.compatible, keys=self.keys_valid)
        except PipelineError as error:
            self.api_ready = False
            self.api_checks = {"error": error.category}
        self.api_checked_at = datetime.now(timezone.utc)

    async def check_ready(self) -> bool:
        """On-demand readiness check used by GET /readyz."""
        async with self._lock:
            await self._check_keys()
            await self._check_ready()
        return self.api_ready

    async def run(self) -> None:
        """Background loop: probe at startup and every refresh interval."""
        while True:
            await asyncio.sleep(self.refresh_seconds)
            await self.probe()

    def snapshot(self) -> dict[str, Any]:
        return {
            "capabilities": dict(self.capabilities),
            "contract_version": self.contract_version,
            "required_contract_version": CONTRACT_VERSION,
            "compatible": self.compatible,
            "contract_errors": list(self.contract_errors),
            "keys_valid": self.keys_valid,
            "probed_at": self.probed_at.isoformat() if self.probed_at else None,
            "probe_error": self.probe_error,
            "pipeline_api_version": self.pipeline_api_version,
        }

    def api_status(self) -> dict[str, Any]:
        return {
            "ready": self.api_ready,
            "checked_at": (
                self.api_checked_at.isoformat() if self.api_checked_at else None
            ),
        }


router = APIRouter(prefix="/app", tags=["capabilities"])


@router.get("/capabilities", dependencies=[Depends(current_user)])
async def get_capabilities(request: Request) -> dict[str, Any]:
    return request.app.state.capabilities.snapshot()
