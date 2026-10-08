"""Cross-job routes forward complete server results, filters and opaque cursors."""

import httpx
import pytest

from tests.pipeline_fixtures import READER_KEY


@pytest.fixture
def global_routes(pipeline):
    def respond(request):
        if request.url.path.endswith("/summary"):
            return httpx.Response(
                200,
                json={
                    "signals": 50001,
                    "companies": 12000,
                    "jobs": 300,
                    "by_materiality": {"high": 50001, "medium": 0, "low": 0},
                    "top_signal": {"key": "hiring", "title": "Hiring", "count": 50001},
                },
            )
        if request.url.path.endswith(".csv"):
            return httpx.Response(
                200,
                content=b"job_id,id,date_precision\r\nj1,7,month\r\n",
                headers={
                    "content-type": "text/csv",
                    "content-disposition": 'attachment; filename="signals.csv"',
                },
            )
        return httpx.Response(
            200,
            json={
                "items": [{"job_id": "j1", "id": 7}, {"job_id": "j2", "id": 7}],
                "next_cursor": "server-cursor",
            },
        )

    for path in ("/v1/signals", "/v1/signals/summary", "/v1/signals/export.csv"):
        pipeline.router.route(method="GET", path=path).mock(side_effect=respond)
    return pipeline


async def test_filters_rows_and_cursor_are_forwarded(viewer_client, global_routes):
    response = await viewer_client.get(
        "/app/signals",
        params={
            "q": "cold storage",
            "limit": 2,
            "after": "opaque",
            "batch_id": "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "items": [{"job_id": "j1", "id": 7}, {"job_id": "j2", "id": 7}],
        "next_cursor": "server-cursor",
    }
    sent = global_routes.calls.last.request
    assert sent.headers["X-API-Key"] == READER_KEY
    assert dict(sent.url.params) == {
        "q": "cold storage",
        "limit": "2",
        "after": "opaque",
        "client_reference_prefix": "ui:0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41:",
    }


async def test_summary_and_csv_are_not_rebuilt_or_capped(viewer_client, global_routes):
    summary = await viewer_client.get("/app/signals/summary?q=storage")
    assert summary.json()["signals"] == 50001
    assert "degraded" not in summary.json() and "truncated" not in summary.json()
    assert global_routes.calls.last.request.url.path == "/v1/signals/summary"
    response = await viewer_client.get("/app/signals/export.csv?q=storage")
    assert response.status_code == 200
    assert response.text == "job_id,id,date_precision\r\nj1,7,month\r\n"
    assert (
        response.headers["content-disposition"] == 'attachment; filename="signals.csv"'
    )
    sent = global_routes.calls.last.request
    assert sent.url.path == "/v1/signals/export.csv"
    assert dict(sent.url.params) == {"q": "storage"}


async def test_incompatible_release_fails_instead_of_falling_back(
    operator_client, pipeline, app
):
    pipeline.openapi["x-scout-contract-version"] = 0
    await app.state.capabilities.probe()
    response = await operator_client.get("/app/signals")
    assert response.status_code == 503
    assert response.json()["error_category"] == "pipeline_contract_incompatible"


async def test_export_error_is_reported_before_streaming(operator_client, pipeline):
    pipeline.router.route(method="GET", path="/v1/signals/export.csv").mock(
        return_value=httpx.Response(
            422, json={"error_category": "invalid_filter", "detail": "Bad filter"}
        )
    )
    response = await operator_client.get("/app/signals/export.csv")
    assert (
        response.status_code == 422
        and response.json()["error_category"] == "invalid_filter"
    )
