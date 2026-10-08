"""Required integration-contract routes for the offline pipeline stub."""

from __future__ import annotations

import copy
from typing import Any

import httpx

from scout_bff.pipeline_contract import REQUIRED_OPERATIONS
from tests.pipeline_support import TASK_FILTERS


def complete_contract_document(document: dict) -> dict:
    document = copy.deepcopy(document)
    document["x-scout-contract-version"] = 1
    for (method, path), parameters in REQUIRED_OPERATIONS.items():
        operation = document["paths"].setdefault(path, {}).setdefault(method, {})
        known = {p.get("name") for p in operation.get("parameters", [])}
        operation.setdefault("parameters", []).extend(
            {"name": name, "in": "query", "schema": {"type": "string"}}
            for name in sorted(parameters - known)
        )
        operation.setdefault("responses", {"200": {"description": "Success"}})
    return document


class ContractRoutesMixin:
    """Operations required by both configured pipeline keys and the dashboard."""

    def _register_contract_routes(self, route: Any) -> None:
        for path in ("/v1/signals", "/v1/signals/summary", "/v1/signals/export.csv"):
            route(method="GET", path=path).mock(side_effect=self._not_found)
        route(method="GET", path="/v1/api-keys").mock(side_effect=self._list_api_keys)
        route(method="GET", path="/v1/tasks").mock(side_effect=self._global_tasks)
        route(method="GET", path="/v1/sources/stats").mock(
            side_effect=self._source_stats
        )
        route(method="GET", path="/v1/access-policies").mock(side_effect=self._policies)
        route(
            method="POST", path__regex=r"^/v1/access-policies/(?P<host>[^/]+)/reset$"
        ).mock(side_effect=self._reset_policy)

    def _list_api_keys(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        return httpx.Response(200, json={"items": [], "next_cursor": None})

    def _global_tasks(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        return self._paginate(
            request, list(self.state["tasks"].values()), "tasks-global", TASK_FILTERS
        )

    def _source_stats(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        return httpx.Response(200, json={"items": [], "next_cursor": None})

    def _policies(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        return httpx.Response(200, json={"items": [], "next_cursor": None})

    def _reset_policy(self, request: httpx.Request, host: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        return httpx.Response(200, json={"host": host, "active": False})
