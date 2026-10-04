"""Test-local extension of the stub pipeline: the B3 global task list (`tasks_global`).

`PipelineStubWithGlobalTasks` advertises `GET /v1/tasks` in its OpenAPI document and
serves it from the stub's task rows, so the B4 aggregates can be exercised in both the
fallback mode (plain `PipelineStub`) and the capability mode.
"""

from __future__ import annotations

import copy

import httpx

from tests.pipeline_stub import PipelineStub
from tests.pipeline_support import TASK_FILTERS

GLOBAL_TASKS_OPERATION = {
    "get": {
        "tags": ["operations"],
        "summary": "List Tasks",
        "operationId": "list_tasks_v1_tasks_get",
        "parameters": [
            {"name": "limit", "in": "query", "schema": {"type": "integer"}},
            {"name": "after", "in": "query", "schema": {"type": "string"}},
            {"name": "status", "in": "query", "schema": {"type": "string"}},
            {"name": "kind", "in": "query", "schema": {"type": "string"}},
            {"name": "created_after", "in": "query", "schema": {"type": "string"}},
        ],
        "responses": {"200": {"description": "Successful Response"}},
    }
}


class PipelineStubWithGlobalTasks(PipelineStub):
    """`PipelineStub` plus `GET /v1/tasks` (B3) — capability `tasks_global` = true."""

    def __init__(self) -> None:
        super().__init__()
        self.openapi = copy.deepcopy(self.openapi)
        self.openapi["paths"]["/v1/tasks"] = GLOBAL_TASKS_OPERATION

    def _register(self) -> None:
        # Registered before the parent's routes so it precedes the catch-all.
        self.router.route(method="GET", path="/v1/tasks").mock(
            side_effect=self._global_tasks
        )
        super()._register()

    def _global_tasks(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        rows = list(self.state["tasks"].values())
        return self._paginate(request, rows, "tasks-global", TASK_FILTERS)
