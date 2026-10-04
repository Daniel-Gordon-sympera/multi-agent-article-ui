"""`GET /app/signals*` with the capability `signals_global`: forwarded to /v1/signals.

The stub pipeline gains a test-local `GET /v1/signals` route (B1) and advertises it in
its OpenAPI document, so the capability probe at app start turns the forwarding on.
"""

from __future__ import annotations

import copy
from typing import Any

import httpx
import pytest

from tests.pipeline_fixtures import JOBS
from tests.pipeline_results_fixtures import SIGNALS
from tests.pipeline_stub import PipelineStub

GLOBAL_FILTERS = {
    "signal": "signal",
    "materiality": "materiality",
    "company_key": "company_key",
    "hq_scope": "hq_scope",
    "org_kind": "org_kind",
    "industry": "company_industry",
    "job_industry": "job_industry",
    "state": "job_state",
    "county": "county",
    "revenue_bin": "revenue_bin",
    "date_after": "date",
    "date_before": "date",
    "job_id": "job_id",
    "batch_id": "batch_id",
}


class GlobalSignalsStub(PipelineStub):
    """Today's stub plus B1's cross-job read, rows spelled like plan §8."""

    def __init__(self) -> None:
        super().__init__()
        self.openapi = copy.deepcopy(self.openapi)
        self.openapi["paths"]["/v1/signals"] = {
            "get": {"summary": "List Signals", "responses": {"200": {}}}
        }

    def _register(self) -> None:
        self.router.route(method="GET", path="/v1/signals").mock(
            side_effect=self._global_signals
        )
        super()._register()

    def global_rows(self) -> list[dict[str, Any]]:
        jobs = {job["id"]: job for job in JOBS}
        rows = []
        for job_id, signals in SIGNALS.items():
            job = jobs[job_id]
            for row in signals:
                rows.append(
                    {
                        **row,
                        "job_id": job_id,
                        "county": job["county"],
                        "job_state": job["state_code"],
                        "job_industry": job["input"].get("industry"),
                        "job_created_at": job["created_at"],
                        "batch_id": None,
                    }
                )
        return rows

    def _global_signals(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request):
            return denied
        return self._paginate(
            request, self.global_rows(), "signals-global", GLOBAL_FILTERS
        )


@pytest.fixture
def pipeline() -> GlobalSignalsStub:
    return GlobalSignalsStub()


def global_calls(pipeline) -> list[httpx.Request]:
    return [
        call.request
        for call in pipeline.calls
        if call.request.url.path == "/v1/signals"
    ]


async def test_capability_is_detected_and_the_page_is_forwarded(
    operator_client, pipeline
):
    assert operator_client.me["capabilities"]["signals_global"] is True
    response = await operator_client.get(
        "/app/signals", params={"materiality": "high", "limit": 10}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["degraded"] is False
    assert "scanned_jobs" not in body
    assert len(body["items"]) == 2
    assert all(row["state_code"] == "FL" for row in body["items"])
    request = global_calls(pipeline)[-1]
    assert request.url.params["materiality"] == "high"
    assert request.url.params["limit"] == "10"
    # no per-job reads happened
    assert not any(
        call.request.url.path.endswith("/signals")
        and call.request.url.path != "/v1/signals"
        for call in pipeline.calls
    )


async def test_api_cursor_is_passed_through(operator_client, pipeline):
    first = (await operator_client.get("/app/signals", params={"limit": 3})).json()
    assert len(first["items"]) == 3 and first["next_cursor"]
    second = (
        await operator_client.get(
            "/app/signals", params={"limit": 3, "after": first["next_cursor"]}
        )
    ).json()
    assert len(second["items"]) == 1 and second["next_cursor"] is None
    assert global_calls(pipeline)[-1].url.params["after"] == first["next_cursor"]


async def test_free_text_is_applied_in_the_bff_over_the_pulled_rows(
    operator_client, pipeline
):
    response = await operator_client.get("/app/signals", params={"q": "cold storage"})
    body = response.json()
    assert body["degraded"] is False and body["truncated"] is False
    assert [row["company"] for row in body["items"]] == ["Peachtree Distribution"]
    assert "q" not in global_calls(pipeline)[-1].url.params


async def test_summary_and_export_use_the_global_read(viewer_client, pipeline):
    summary = (await viewer_client.get("/app/signals/summary")).json()
    assert summary["degraded"] is False
    assert summary["signals"] == 4 and summary["jobs"] == 2
    assert summary["by_materiality"] == {"high": 2, "medium": 1, "low": 1}

    async with viewer_client.stream("GET", "/app/signals/export.csv") as response:
        assert response.status_code == 200
        text = b"".join([chunk async for chunk in response.aiter_bytes()]).decode()
    lines = [line for line in text.split("\r\n") if line]
    assert len(lines) == 5
    assert lines[0].endswith(",job_id,county,state,job_industry")
    assert any(line.endswith(",Fulton,GA,Wholesale Trade") for line in lines[1:])
    assert all(
        request.url.params["limit"] == "1000" for request in global_calls(pipeline)
    )
