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
from scout_bff.pipeline_client import PipelineClient, PipelineError
from scout_bff.settings import placeholder_settings
from tests.pipeline_fixtures import OPERATOR_KEY, PIPELINE_URL, READER_KEY
from tests.pipeline_stub import PipelineStub


def test_missing_contract_is_incompatible():
    from scout_bff.pipeline_contract import contract_errors

    assert contract_errors({})


def test_required_routes_and_query_parameters_are_checked():
    from scout_bff.pipeline_contract import contract_errors

    stub = PipelineStub()
    assert contract_errors(stub.openapi) == []
    broken = copy.deepcopy(stub.openapi)
    del broken["paths"]["/v1/signals/summary"]
    broken["paths"]["/v1/jobs"]["get"]["parameters"] = []
    errors = contract_errors(broken)
    assert any("/v1/signals/summary" in error for error in errors)
    assert any("order" in error for error in errors)
    broken["x-scout-contract-version"] = 2
    assert any("contract 1" in error for error in contract_errors(broken))


def test_complete_document_has_all_capabilities():
    capabilities = derive_capabilities(PipelineStub().openapi)
    assert set(capabilities) == set(CAPABILITY_NAMES)
    assert all(capabilities.values())


def _client(stub: PipelineStub) -> PipelineClient:
    settings = placeholder_settings(
        pipeline_api_url=PIPELINE_URL,
        pipeline_operator_key=OPERATOR_KEY,
        pipeline_reader_key=READER_KEY,
    )
    return PipelineClient(stub.http_client(), settings)


async def test_cache_probe_reads_version_and_readiness():
    stub = PipelineStub()
    stub.openapi["info"]["version"] = "9.8.7"
    cache = CapabilityCache(_client(stub), refresh_seconds=300)
    assert cache.probe_error == "not probed yet"
    await cache.probe()
    assert cache.probe_error is None
    assert cache.pipeline_api_version == "9.8.7"
    assert all(cache.capabilities.values())
    assert cache.compatible and cache.keys_valid
    assert cache.api_ready is True
    snapshot = cache.snapshot()
    assert snapshot["probed_at"] and snapshot["compatible"]
    stub.ready = False
    assert await cache.check_ready() is False
    assert cache.api_status()["ready"] is False


async def test_cache_probe_failure_sets_probe_error_and_all_false():
    stub = PipelineStub()
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


def test_captured_backend_contract_is_compatible_without_stub_repair():
    from scout_bff.pipeline_contract import contract_errors
    from tests.pipeline_stub import load_openapi_document

    assert contract_errors(load_openapi_document()) == []


@pytest.mark.parametrize(
    "reader,operator",
    [
        (OPERATOR_KEY, OPERATOR_KEY),
        (READER_KEY, READER_KEY),
        (OPERATOR_KEY, READER_KEY),
        ("invalid-reader", OPERATOR_KEY),
        (READER_KEY, "invalid-operator"),
    ],
)
async def test_key_roles_fail_closed(reader, operator):
    stub = PipelineStub()
    settings = placeholder_settings(
        pipeline_api_url=PIPELINE_URL,
        pipeline_reader_key=reader,
        pipeline_operator_key=operator,
    )
    cache = CapabilityCache(PipelineClient(stub.http_client(), settings), 300)
    await cache.probe()
    assert cache.compatible
    assert not cache.keys_valid and not cache.api_ready
    with pytest.raises(PipelineError) as error:
        cache.require_compatible()
    assert error.value.status == 503
    assert error.value.category == "pipeline_keys_invalid"


def test_existing_screen_endpoints_are_required_too():
    from scout_bff.pipeline_contract import contract_errors
    from tests.pipeline_stub import load_openapi_document

    document = load_openapi_document()
    del document["paths"]["/v1/workers"]
    assert any("/v1/workers" in error for error in contract_errors(document))
