"""Pure-function checks: CSRF rules, role hierarchy → keys, proxy allowlist."""

import pytest

from scout_bff.auth.csrf import check_csrf, is_unsafe
from scout_bff.auth.roles import (
    pipeline_key_for_role,
    pipeline_key_role,
    role_satisfies,
)
from scout_bff.errors import Problem
from scout_bff.proxy.allowlist import RULES, match_rule, role_allowed
from scout_bff.settings import placeholder_settings

TOKEN = "session-csrf-token"
GOOD = {"X-Requested-With": "scout", "X-CSRF-Token": TOKEN}


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "post"])
def test_unsafe_methods_need_both_headers(method):
    assert is_unsafe(method)
    check_csrf(method, GOOD, TOKEN)
    for headers in ({}, {"X-Requested-With": "scout"}, {"X-CSRF-Token": TOKEN}):
        with pytest.raises(Problem) as error:
            check_csrf(method, headers, TOKEN)
        assert error.value.status_code == 403
        assert error.value.category == "csrf_failed"


def test_wrong_token_or_wrong_requested_with_value_fails():
    with pytest.raises(Problem):
        check_csrf("POST", {**GOOD, "X-CSRF-Token": "other"}, TOKEN)
    with pytest.raises(Problem):
        check_csrf("POST", {**GOOD, "X-Requested-With": "XMLHttpRequest"}, TOKEN)


@pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS"])
def test_safe_methods_skip_csrf(method):
    assert not is_unsafe(method)
    check_csrf(method, {}, TOKEN)


def test_role_hierarchy():
    assert role_satisfies("admin", "viewer")
    assert role_satisfies("admin", "operator")
    assert role_satisfies("operator", "viewer")
    assert not role_satisfies("operator", "admin")
    assert not role_satisfies("viewer", "operator")
    assert not role_satisfies("unknown", "viewer")


def test_role_to_pipeline_key_mapping():
    settings = placeholder_settings(
        pipeline_operator_key="operator-secret", pipeline_reader_key="reader-secret"
    )
    assert pipeline_key_role("admin") == "operator"
    assert pipeline_key_role("operator") == "operator"
    assert pipeline_key_role("viewer") == "reader"
    assert pipeline_key_for_role(settings, "admin") == "operator-secret"
    assert pipeline_key_for_role(settings, "operator") == "operator-secret"
    assert pipeline_key_for_role(settings, "viewer") == "reader-secret"


def test_allowlist_covers_every_v1_route_of_the_routes_file():
    routes_file = __import__("pathlib").Path("docs/api/pipeline-routes.txt")
    expected = set()
    for line in routes_file.read_text().splitlines():
        method, path = line.split()[:2]
        if path.startswith("/v1/"):
            expected.add((method, path))
    assert len(expected) == 33
    for method, template in expected:
        sample = (
            template.replace("{job_id}", "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41")
            .replace("{site_run_id}", "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41")
            .replace("{article_id}", "71334")
            .replace("{task_id}", "48920")
            .replace("{company_key}", "lakeview-builders-group")
            .replace("{export_id}", "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41")
            .replace("{kind}", "text")
            .replace("{sha}", "a" * 64)
            .replace("{name}", "ci-key")
            .replace("{table}", "signals")
        )
        assert match_rule(method, sample) is not None, (method, sample)
    assert len(RULES) == 33


@pytest.mark.parametrize(
    "method, path, min_role",
    [
        ("GET", "/v1/jobs", "viewer"),
        ("GET", "/v1/jobs/abc/export/signals.csv", "viewer"),
        ("POST", "/v1/jobs", "operator"),
        ("POST", "/v1/jobs/abc/cancel", "operator"),
        ("POST", "/v1/tasks/1/retry", "operator"),
        ("POST", "/v1/exports", "operator"),
        ("POST", "/v1/api-keys", "admin"),
        ("DELETE", "/v1/api-keys/ci", "admin"),
    ],
)
def test_allowlist_roles(method, path, min_role):
    rule = match_rule(method, path)
    assert rule is not None and rule.min_role == min_role
    assert role_allowed(rule, "admin")
    assert role_allowed(rule, "viewer") == (min_role == "viewer")
    assert role_allowed(rule, "operator") == (min_role != "admin")


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/v1/signals"),
        ("GET", "/v1/tasks"),
        ("POST", "/v1/jobs/abc/retry-dead"),
        ("GET", "/v1/api-keys"),
        ("DELETE", "/v1/jobs/abc"),
        ("PUT", "/v1/jobs"),
        ("GET", "/v1/jobs/abc/export/signals.csv/extra"),
        ("GET", "/v1/jobs/abc/export/signals.json"),
        ("GET", "/healthz"),
        ("GET", "/v1/"),
    ],
)
def test_allowlist_rejects_unknown_routes(method, path):
    assert match_rule(method, path) is None
