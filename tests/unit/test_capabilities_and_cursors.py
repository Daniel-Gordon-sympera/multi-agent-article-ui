"""Capability derivation from OpenAPI documents; opaque cursor round trips."""

import copy

import pytest

from scout_bff.capabilities import (
    CAPABILITY_NAMES,
    CapabilityCache,
    all_false,
    derive_capabilities,
)
from scout_bff.cursors import (
    cursor_scope,
    decode_cursor,
    decode_offset_cursor,
    encode_cursor,
    encode_offset_cursor,
)
from scout_bff.errors import Problem
from scout_bff.pipeline_client import PipelineClient
from scout_bff.settings import placeholder_settings
from tests.pipeline_fixtures import OPERATOR_KEY, PIPELINE_URL, READER_KEY
from tests.pipeline_stub import PipelineStub, load_openapi_document


def test_todays_document_has_no_optional_capability():
    capabilities = derive_capabilities(load_openapi_document())
    assert set(capabilities) == set(CAPABILITY_NAMES)
    assert capabilities == all_false()


def test_document_with_b1_to_b4_routes_turns_capabilities_on():
    document = copy.deepcopy(load_openapi_document())
    paths = document["paths"]
    paths["/v1/signals"] = {"get": {"responses": {"200": {}}}}
    paths["/v1/tasks"] = {"get": {"responses": {"200": {}}}}
    paths["/v1/jobs/{id}/retry-dead"] = {"post": {"responses": {"202": {}}}}
    paths["/v1/api-keys"]["get"] = {"responses": {"200": {}}}
    paths["/v1/sources/stats"] = {"get": {"responses": {"200": {}}}}
    paths["/v1/stats/cost-estimate"] = {"get": {"responses": {"200": {}}}}
    paths["/v1/jobs"]["get"]["parameters"].append(
        {"name": "industry", "in": "query", "schema": {"type": "string"}}
    )
    capabilities = derive_capabilities(document)
    assert capabilities == {
        "signals_global": True,
        "tasks_global": True,
        "retry_dead": True,
        "api_keys_list": True,
        "sources_stats": True,
        "cost_estimate": True,
        "jobs_industry_filter": True,
        "jobs_reference_filter": False,
    }


def test_only_signals_route_added():
    document = copy.deepcopy(load_openapi_document())
    document["paths"]["/v1/signals"] = {"get": {"responses": {"200": {}}}}
    capabilities = derive_capabilities(document)
    assert capabilities["signals_global"] is True
    assert sum(capabilities.values()) == 1


def test_garbage_documents_derive_all_false():
    assert derive_capabilities({}) == all_false()
    assert derive_capabilities({"paths": {"/v1/signals": "nope"}}) == all_false()


def _client(stub: PipelineStub) -> PipelineClient:
    settings = placeholder_settings(
        pipeline_api_url=PIPELINE_URL,
        pipeline_operator_key=OPERATOR_KEY,
        pipeline_reader_key=READER_KEY,
    )
    return PipelineClient(stub.http_client(), settings)


async def test_cache_probe_reads_version_and_readiness():
    stub = PipelineStub()
    cache = CapabilityCache(_client(stub), refresh_seconds=300)
    assert cache.probe_error == "not probed yet"
    await cache.probe()
    assert cache.probe_error is None
    assert cache.pipeline_api_version == "1.0.0"
    assert cache.capabilities == all_false()
    assert cache.api_ready is True
    snapshot = cache.snapshot()
    assert snapshot["probed_at"] and snapshot["capabilities"] == all_false()
    stub.ready = False
    assert await cache.check_ready() is False
    assert cache.api_status()["ready"] is False


async def test_cache_probe_failure_sets_probe_error_and_all_false():
    stub = PipelineStub()
    stub.openapi = copy.deepcopy(load_openapi_document())
    stub.openapi["paths"]["/v1/signals"] = {"get": {}}
    cache = CapabilityCache(_client(stub), refresh_seconds=300)
    await cache.probe()
    assert cache.capabilities["signals_global"] is True
    stub.down = True
    await cache.probe()
    assert cache.capabilities == all_false()
    assert "pipeline_api_unavailable" in (cache.probe_error or "")
    assert cache.api_ready is False


def test_cursor_round_trip_and_scope_binding():
    scope = cursor_scope("signals", {"state": "FL"})
    assert scope == cursor_scope("signals", {"state": "FL"})
    assert scope != cursor_scope("signals", {"state": "GA"})
    cursor = encode_cursor(scope, "0000000000000000000042")
    assert "=" not in cursor
    assert decode_cursor(cursor, scope) == "0000000000000000000042"
    with pytest.raises(Problem) as error:
        decode_cursor(cursor, cursor_scope("signals", {"state": "GA"}))
    assert error.value.status_code == 400
    assert error.value.category == "invalid_cursor"


@pytest.mark.parametrize("bad", ["", "not-base64!", "e30", "x" * 9000])
def test_invalid_cursors_are_rejected(bad):
    with pytest.raises(Problem):
        decode_cursor(bad, "scope")


def test_offset_cursors():
    scope = cursor_scope("signals", {})
    assert decode_offset_cursor(None, scope) == 0
    assert decode_offset_cursor(encode_offset_cursor(scope, 200), scope) == 200
    with pytest.raises(Problem):
        decode_offset_cursor(encode_cursor(scope, "abc"), scope)
