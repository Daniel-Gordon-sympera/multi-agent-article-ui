"""A respx-backed stand-in for the pipeline API, used by every BFF test."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs

import httpx
import respx

from tests.pipeline_fixtures import (
    OPERATOR_KEY,
    PIPELINE_URL,
    READER_KEY,
    SIGNALS_CSV_COLUMNS,
)
from tests.pipeline_results_fixtures import fresh_state
from tests.pipeline_stub_jobs import JobsRoutesMixin
from tests.pipeline_stub_mutations import MutationRoutesMixin
from tests.pipeline_support import (
    JOB_FILTERS,
    SIGNAL_FILTERS,
    TASK_FILTERS,
    decode_cursor,
    encode_cursor,
    problem,
)

OPENAPI_PATH = Path(__file__).resolve().parents[1] / "docs/api/openapi-pipeline.json"


def load_openapi_document() -> dict[str, Any]:
    return json.loads(OPENAPI_PATH.read_text())


class PipelineStub(MutationRoutesMixin, JobsRoutesMixin):
    """Mutable in-memory pipeline; `router.handler` plugs into httpx.MockTransport."""

    def __init__(self) -> None:
        self.state = fresh_state()
        self.openapi = load_openapi_document()
        self.ready = True
        self.down = False
        self.fail_connects = 0
        self.created_jobs: list[dict[str, Any]] = []
        self.router = respx.MockRouter(
            base_url=PIPELINE_URL, assert_all_called=False, assert_all_mocked=True
        )
        self._register()

    # -- wiring ---------------------------------------------------------------

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.router.handler)

    def http_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=PIPELINE_URL, transport=self.transport())

    @property
    def calls(self):
        return self.router.calls

    def _register(self) -> None:
        route = self.router.route
        route(method="GET", path="/openapi.json").mock(side_effect=self._openapi)
        route(method="GET", path="/readyz").mock(side_effect=self._readyz)
        route(method="GET", path="/v1/jobs").mock(side_effect=self._list_jobs)
        route(method="POST", path="/v1/jobs").mock(side_effect=self._create_job)
        route(method="GET", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)$").mock(
            side_effect=self._get_job
        )
        route(method="GET", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/tasks$").mock(
            side_effect=self._job_tasks
        )
        route(method="GET", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/signals$").mock(
            side_effect=self._job_signals
        )
        route(method="GET", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/ranking$").mock(
            side_effect=self._job_ranking
        )
        route(
            method="GET",
            path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/export/(?P<table>[a-z_]+)\.csv$",
        ).mock(side_effect=self._export_csv)
        route(method="POST", path__regex=r"^/v1/jobs/(?P<job_id>[^/]+)/cancel$").mock(
            side_effect=self._cancel_job
        )
        route(method="POST", path__regex=r"^/v1/tasks/(?P<task_id>\d+)/retry$").mock(
            side_effect=self._retry_task
        )
        route(method="GET", path="/v1/workers").mock(side_effect=self._workers)
        route(method="GET", path="/v1/stats/daily").mock(side_effect=self._daily)
        route(method="GET", path="/v1/finder/memory").mock(
            side_effect=self._finder_memory
        )
        route(method="POST", path="/v1/api-keys").mock(side_effect=self._create_key)
        route(method="DELETE", path__regex=r"^/v1/api-keys/(?P<name>[^/]+)$").mock(
            side_effect=self._revoke_key
        )
        self._register_jobs_routes(route)
        route().mock(side_effect=self._not_found)

    # -- helpers --------------------------------------------------------------

    def _gate(self, request: httpx.Request) -> None:
        if self.fail_connects > 0:
            self.fail_connects -= 1
            raise httpx.ConnectError(
                "stub: transient connection failure", request=request
            )
        if self.down:
            raise httpx.ConnectError("stub: pipeline API is down", request=request)

    def _authenticate(
        self, request: httpx.Request, *, operator: bool = False
    ) -> httpx.Response | None:
        key = request.headers.get("X-API-Key")
        if not key:
            return problem(
                request, 401, "api_key_required", "An X-API-Key is required."
            )
        if key not in {OPERATOR_KEY, READER_KEY}:
            return problem(request, 401, "api_key_invalid", "The API key is invalid.")
        if operator and key != OPERATOR_KEY:
            return problem(
                request,
                403,
                "operator_required",
                "This action requires an operator key.",
            )
        return None

    @staticmethod
    def _query(request: httpx.Request) -> dict[str, str]:
        parsed = parse_qs(request.url.query.decode(), keep_blank_values=True)
        return {key: values[-1] for key, values in parsed.items()}

    def _paginate(
        self,
        request: httpx.Request,
        rows: list[dict[str, Any]],
        name: str,
        filters: dict[str, str],
        *,
        key: str = "id",
    ) -> httpx.Response:
        query = self._query(request)
        unknown = set(query) - set(filters) - {"limit", "after"}
        if unknown:
            return problem(
                request,
                422,
                "unknown_filter",
                f"Unsupported filters: {', '.join(sorted(unknown))}.",
            )
        try:
            limit = int(query.get("limit", "100"))
        except ValueError:
            limit = 0
        if not 1 <= limit <= 1000:
            return problem(request, 422, "invalid_limit", "limit must be 1..1000.")
        for parameter, column in filters.items():
            value = query.get(parameter)
            if value is None:
                continue
            if parameter == "created_after":
                rows = [row for row in rows if str(row[column]) > value]
            elif parameter == "created_before":
                rows = [row for row in rows if str(row[column]) < value]
            else:
                rows = [
                    row for row in rows if str(row.get(column)).lower() == value.lower()
                ]
        scope = hashlib.sha256(
            json.dumps(
                [name, {k: v for k, v in query.items() if k in filters}]
            ).encode()
        ).hexdigest()[:24]
        rows = sorted(rows, key=lambda row: str(row[key]))
        if query.get("after"):
            try:
                cursor = decode_cursor(query["after"])
                assert cursor["scope"] == scope
            except Exception:
                return problem(request, 400, "invalid_cursor", "Invalid cursor.")
            rows = [row for row in rows if str(row[key]) > cursor["key"]]
        page, rest = rows[:limit], rows[limit:]
        next_cursor = encode_cursor(scope, str(page[-1][key])) if rest else None
        return httpx.Response(200, json={"items": page, "next_cursor": next_cursor})

    def _job_or_404(self, request: httpx.Request, job_id: str):
        job = self.state["jobs"].get(job_id)
        if job is None:
            return None, problem(
                request,
                404,
                "resource_not_found",
                "The requested resource does not exist.",
            )
        return job, None

    # -- routes ---------------------------------------------------------------

    def _openapi(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        return httpx.Response(200, json=self.openapi)

    def _readyz(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        checks = {"database": True, "artifact_store": True, "migrations": self.ready}
        return httpx.Response(
            200 if self.ready else 503,
            json={"status": "ready" if self.ready else "not_ready", "checks": checks},
        )

    def _not_found(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        return problem(request, 404, "http_error", "Not Found")

    def _list_jobs(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        rows = [
            {k: v for k, v in job.items() if k not in {"progress", "costs"}}
            for job in self.state["jobs"].values()
        ]
        return self._paginate(request, rows, "jobs", JOB_FILTERS)

    def _get_job(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        job, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        encoded = json.dumps(job, sort_keys=True, separators=(",", ":"))
        etag = '"' + hashlib.sha256(encoded.encode()).hexdigest() + '"'
        headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
        validators = request.headers.get("if-none-match", "").split(",")
        if any(value.strip() in {etag, "*"} for value in validators if value.strip()):
            return httpx.Response(304, headers=headers)
        return httpx.Response(200, json=job, headers=headers)

    def _job_tasks(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        rows = [t for t in self.state["tasks"].values() if t["job_id"] == job_id]
        return self._paginate(request, rows, "tasks", TASK_FILTERS)

    def _job_signals(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        rows = self.state["signals"].get(job_id, [])
        return self._paginate(request, rows, "signals", SIGNAL_FILTERS)

    def _job_ranking(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        rows = self.state["rankings"].get(job_id, [])
        filters = {"tier": "tier", "chosen": "chosen"}
        return self._paginate(request, rows, "ranking", filters, key="overall_rank")

    def _export_csv(
        self, request: httpx.Request, job_id: str, table: str
    ) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        _, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        if table != "signals":
            return problem(request, 404, "http_error", "Unknown export table")
        rows = self.state["signals"].get(job_id, [])

        async def chunks():
            yield (",".join(SIGNALS_CSV_COLUMNS) + "\n").encode()
            for row in rows:
                values = [
                    str(row.get(column, "")).replace(",", " ")
                    for column in SIGNALS_CSV_COLUMNS
                ]
                yield (",".join(values) + "\n").encode()

        return httpx.Response(
            200,
            content=chunks(),
            headers={
                "content-type": "text/csv; charset=utf-8",
                "content-disposition": f'attachment; filename="{table}.csv"',
            },
        )

    def _workers(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        return self._paginate(
            request,
            self.state["workers"],
            "workers",
            {"role": "role"},
            key="instance_id",
        )

    def _daily(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        return self._paginate(
            request, self.state["daily"], "daily", {"created_after": "day"}, key="day"
        )

    def _finder_memory(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        filters = {
            "location": "location_key",
            "industry": "industry_key",
            "domain": "domain",
            "verdict": "verdict",
            "created_after": "judged_at",
        }
        return self._paginate(
            request, self.state["finder_memory"], "finder-memory", filters, key="domain"
        )
