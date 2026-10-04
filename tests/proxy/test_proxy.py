"""/v1 passthrough: allowlist, role keys, headers, bodies, streams, failures."""

import json

from tests.pipeline_fixtures import (
    DEAD_TASK_ID,
    JOB_ANALYSING,
    OPERATOR_KEY,
    READER_KEY,
)


async def test_get_passes_status_body_and_query_through(operator_client, pipeline):
    response = await operator_client.get("/v1/jobs?state=FL&limit=1")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    body = response.json()
    assert len(body["items"]) == 1 and body["next_cursor"]
    upstream = pipeline.calls.last.request
    assert upstream.url.path == "/v1/jobs"
    assert upstream.url.query == b"state=FL&limit=1"
    assert upstream.headers["X-API-Key"] == OPERATOR_KEY
    assert upstream.headers["Accept-Encoding"] == "identity"
    assert "cookie" not in upstream.headers
    page_two = await operator_client.get(
        f"/v1/jobs?state=FL&limit=1&after={body['next_cursor']}"
    )
    assert page_two.status_code == 200 and page_two.json()["next_cursor"] is None


async def test_viewer_uses_reader_key_and_cannot_mutate(viewer_client, pipeline):
    assert (await viewer_client.get("/v1/workers")).status_code == 200
    assert pipeline.calls.last.request.headers["X-API-Key"] == READER_KEY
    csv = await viewer_client.get(f"/v1/jobs/{JOB_ANALYSING}/export/signals.csv")
    assert csv.status_code == 200  # per-job CSV is allowed for viewers
    for method, path in (
        ("POST", "/v1/jobs"),
        ("POST", f"/v1/jobs/{JOB_ANALYSING}/cancel"),
        ("POST", f"/v1/tasks/{DEAD_TASK_ID}/retry"),
        ("POST", "/v1/exports"),
        ("POST", "/v1/api-keys"),
    ):
        calls_before = len(pipeline.calls)
        response = await viewer_client.request(method, path, json={})
        assert response.status_code == 403, path
        assert response.json()["error_category"] in {
            "operator_required",
            "admin_required",
        }
        assert len(pipeline.calls) == calls_before  # never reached the pipeline


async def test_incoming_api_key_header_is_stripped(operator_client, pipeline):
    response = await operator_client.get(
        "/v1/workers", headers={"X-API-Key": "attacker-supplied"}
    )
    assert response.status_code == 200
    upstream = pipeline.calls.last.request
    assert upstream.headers["X-API-Key"] == OPERATOR_KEY
    assert "cookie" not in upstream.headers


async def test_api_keys_are_admin_only(operator_client, admin_client, pipeline):
    denied = await operator_client.post(
        "/v1/api-keys", json={"name": "ci", "role": "reader"}
    )
    assert denied.status_code == 403
    assert denied.json()["error_category"] == "admin_required"
    created = await admin_client.post(
        "/v1/api-keys", json={"name": "ci", "role": "reader"}
    )
    assert created.status_code == 201
    assert created.json()["key"].startswith("sympera_")
    assert created.headers["cache-control"] == "no-store"
    assert pipeline.calls.last.request.headers["X-API-Key"] == OPERATOR_KEY
    assert json.loads(pipeline.calls.last.request.content) == {
        "name": "ci",
        "role": "reader",
    }
    revoked = await admin_client.delete("/v1/api-keys/ci")
    assert revoked.status_code == 204 and revoked.content == b""
    assert (await operator_client.delete("/v1/api-keys/ci")).status_code == 403


async def test_operator_post_and_upstream_problems_pass_through(
    operator_client, pipeline
):
    body = {
        "kind": "location_industry",
        "location": "Orlando, FL",
        "industry": "Construction",
        "county": "Orange",
        "state": "FL",
        "client_reference": "ui:test:construction",
    }
    created = await operator_client.post("/v1/jobs", json=body)
    assert created.status_code == 202
    assert created.json()["status"] == "queued"
    assert pipeline.calls.last.request.headers["content-type"] == "application/json"
    conflict = await operator_client.post("/v1/jobs", json=body)
    assert conflict.status_code == 409
    assert conflict.headers["content-type"] == "application/problem+json"
    assert conflict.json()["error_category"] == "client_reference_exists"
    assert conflict.json()["job_id"] == created.json()["job_id"]
    retry = await operator_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    assert retry.status_code == 202
    again = await operator_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    assert again.status_code == 409
    assert again.json()["error_category"] == "task_not_dead"
    cancelled = await operator_client.post(f"/v1/jobs/{JOB_ANALYSING}/cancel")
    assert cancelled.json() == {"job_id": JOB_ANALYSING, "status": "cancelling"}


async def test_etag_and_304_pass_through(viewer_client):
    first = await viewer_client.get(f"/v1/jobs/{JOB_ANALYSING}")
    assert first.status_code == 200
    etag = first.headers["etag"]
    assert (
        etag.startswith('"') and first.headers["cache-control"] == "private, no-cache"
    )
    second = await viewer_client.get(
        f"/v1/jobs/{JOB_ANALYSING}", headers={"If-None-Match": etag}
    )
    assert second.status_code == 304
    assert second.headers["etag"] == etag
    assert second.content == b""
    assert (
        "content-length" not in second.headers
        or second.headers["content-length"] == "0"
    )


async def test_unknown_routes_are_404_not_proxied(viewer_client, pipeline):
    calls_before = len(pipeline.calls)
    for method, path in (
        ("GET", "/v1/signals"),
        ("GET", "/v1/nope"),
        ("DELETE", f"/v1/jobs/{JOB_ANALYSING}"),
        ("GET", "/v1/jobs/x/export/signals.json"),
    ):
        response = await viewer_client.request(method, path)
        assert response.status_code == 404, path
        assert response.json()["error_category"] == "not_proxied"
    assert len(pipeline.calls) == calls_before


async def test_upstream_404_is_passed_through(viewer_client):
    response = await viewer_client.get("/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error_category"] == "resource_not_found"


async def test_csv_export_streams_with_disposition(viewer_client):
    async with viewer_client.stream(
        "GET", f"/v1/jobs/{JOB_ANALYSING}/export/signals.csv"
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert response.headers["content-disposition"] == (
            'attachment; filename="signals.csv"'
        )
        chunks = [chunk async for chunk in response.aiter_bytes()]
    text = b"".join(chunks).decode()
    lines = text.strip().splitlines()
    assert lines[0].startswith("company,signal,")
    assert len(lines) == 4
    assert "Lakeview Builders Group" in lines[1]


async def test_pipeline_down_is_503_and_gets_retry_on_connect_errors(
    viewer_client, pipeline
):
    pipeline.down = True
    response = await viewer_client.get("/v1/workers")
    assert response.status_code == 503
    assert response.json()["error_category"] == "pipeline_api_unavailable"
    assert response.headers["content-type"] == "application/problem+json"
    pipeline.down = False
    pipeline.fail_connects = 2
    recovered = await viewer_client.get("/v1/workers")
    assert recovered.status_code == 200
    assert pipeline.fail_connects == 0


async def test_posts_do_not_retry_connection_errors(operator_client, pipeline):
    pipeline.fail_connects = 1
    response = await operator_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    assert response.status_code == 503
    assert pipeline.fail_connects == 0
    assert (
        await operator_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    ).status_code == 202


async def test_proxy_requires_a_session_and_csrf(client, operator_client):
    anonymous = await client.get("/v1/jobs")
    assert anonymous.status_code == 401
    assert anonymous.json()["error_category"] == "not_authenticated"
    operator_client.headers.pop("X-CSRF-Token")
    response = await operator_client.post(f"/v1/tasks/{DEAD_TASK_ID}/retry")
    assert response.status_code == 403
    assert response.json()["error_category"] == "csrf_failed"


async def test_security_headers_on_proxied_responses(viewer_client):
    response = await viewer_client.get("/v1/workers")
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["content-security-policy"].startswith("default-src 'self'")
    assert response.headers["x-request-id"]
