"""Job-related routes of the stub pipeline API: site runs, retry-dead, cost estimate.

`retry-dead` and `cost-estimate` are the optional B2/B3 routes: the stub always
serves them, the BFF only calls them when the OpenAPI probe lists them.
"""

from __future__ import annotations

from typing import Any

import httpx

from tests.pipeline_support import problem

COST_ESTIMATE = {"median_cost_usd": 2.95, "p90_cost_usd": 3.4, "samples": 10}


class JobsRoutesMixin:
    """Mixed into PipelineStub; relies on its state, _gate, _authenticate, _paginate."""

    def _register_jobs_routes(self, route: Any) -> None:
        route(method="GET", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/site-runs$").mock(
            side_effect=self._job_site_runs
        )
        route(
            method="POST", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/retry-dead$"
        ).mock(side_effect=self._retry_dead)
        route(method="GET", path="/v1/stats/cost-estimate").mock(
            side_effect=self._cost_estimate
        )

    def _job_site_runs(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        rows = self.state["site_runs"].get(job_id, [])
        return self._paginate(request, rows, "site-runs", {"status": "status"})

    def _retry_dead(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        retried: list[int] = []
        for task in self.state["tasks"].values():
            if task["job_id"] == job_id and task["status"] == "dead":
                task["status"], task["attempts"] = "queued", 0
                retried.append(task["id"])
        self.state.setdefault("retry_dead_calls", []).append(job_id)
        return httpx.Response(
            202, json={"job_id": job_id, "retried": len(retried), "task_ids": retried}
        )

    def _cost_estimate(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        query = self._query(request)
        if query.get("kind") not in {None, "location_industry", "seeds", "url"}:
            return problem(request, 422, "validation_error", "unknown kind")
        self.state.setdefault("cost_estimate_calls", []).append(query)
        return httpx.Response(200, json=dict(COST_ESTIMATE))
