"""Required pipeline operations and query parameters for this UI release."""

from __future__ import annotations

import re
from typing import Any

from scout_bff.proxy.allowlist import RULES

CONTRACT_VERSION = 1
PATH_PARAMETER = re.compile(r"\{[^}]*\}")
SIGNAL_FILTERS = {
    "signal",
    "materiality",
    "company_key",
    "hq_scope",
    "org_kind",
    "industry",
    "job_industry",
    "state",
    "county",
    "revenue_bin",
    "job_id",
    "client_reference_prefix",
    "date_after",
    "date_before",
    "q",
}
REQUIRED_OPERATIONS: dict[tuple[str, str], set[str]] = {
    ("get", "/v1/jobs"): {
        "limit",
        "after",
        "order",
        "kind",
        "industry",
        "client_reference_prefix",
        "q",
        "status_group",
        "status",
        "state",
        "county",
    },
    ("get", "/v1/signals"): SIGNAL_FILTERS | {"limit", "after"},
    ("get", "/v1/signals/summary"): SIGNAL_FILTERS,
    ("get", "/v1/signals/export.csv"): SIGNAL_FILTERS,
    ("get", "/v1/tasks"): {"limit", "after", "status"},
    ("post", "/v1/jobs/{job_id}/retry-dead"): set(),
    ("get", "/v1/jobs/{job_id}/signals"): {"id"},
    ("get", "/v1/companies/{company_key}"): {"state", "job_id"},
    ("get", "/v1/api-keys"): {"limit", "after"},
    ("get", "/v1/access-policies"): {"limit", "after", "active"},
    ("post", "/v1/access-policies/{host}/reset"): set(),
    ("get", "/v1/sources/stats"): {"domain"},
    ("get", "/v1/stats/cost-estimate"): {"kind", "sites", "days", "industry"},
}


def normalise_path(path: str) -> str:
    return PATH_PARAMETER.sub("{}", path.rstrip("/"))


def query_parameters(operation: dict, path_item: dict) -> set[str]:
    return {
        parameter["name"]
        for parameter in [
            *path_item.get("parameters", []),
            *operation.get("parameters", []),
        ]
        if isinstance(parameter, dict)
        and parameter.get("in") == "query"
        and isinstance(parameter.get("name"), str)
    }


def contract_errors(document: dict[str, Any]) -> list[str]:
    errors = []
    if document.get("x-scout-contract-version") != CONTRACT_VERSION:
        errors.append(f"Requires pipeline Scout contract {CONTRACT_VERSION}.")
    paths = document.get("paths") or {}
    normalised = {
        normalise_path(path): item
        for path, item in paths.items()
        if isinstance(item, dict)
    }
    required_operations = {
        (method, normalise_path(path)): parameters
        for (method, path), parameters in REQUIRED_OPERATIONS.items()
    }
    for rule in RULES:
        path = (
            rule.pattern.pattern.replace("[^/]+", "{}")
            .replace(r"[A-Za-z0-9_-]+\.csv", "{}.csv")
            .replace(r"\.", ".")
        )
        required_operations.setdefault((rule.method.lower(), path), set())
    required_operations.setdefault(("get", "/readyz"), set())
    for (method, path), required in required_operations.items():
        item = normalised.get(normalise_path(path), {})
        operation = item.get(method)
        if not isinstance(operation, dict):
            errors.append(f"Missing {method.upper()} {path}.")
            continue
        missing = required - query_parameters(operation, item)
        if missing:
            errors.append(
                f"{method.upper()} {path} missing: {', '.join(sorted(missing))}."
            )
    return errors
