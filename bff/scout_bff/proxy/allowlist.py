"""(method, path regex, minimum role) for every route in docs/api/pipeline-routes.txt."""

from __future__ import annotations

import re
from dataclasses import dataclass

from scout_bff.auth.roles import role_satisfies

_ID = r"[^/]+"
_TABLE = r"[A-Za-z0-9_-]+\.csv"


@dataclass(frozen=True)
class ProxyRule:
    method: str
    pattern: re.Pattern[str]
    min_role: str

    def matches(self, method: str, path: str) -> bool:
        return (
            self.method == method.upper() and self.pattern.fullmatch(path) is not None
        )


def _rule(method: str, path: str, min_role: str = "viewer") -> ProxyRule:
    return ProxyRule(method, re.compile(path), min_role)


# Keep in step with docs/api/pipeline-routes.txt (34 routes; /healthz and /readyz
# are not proxied because the BFF has its own). Never widen beyond that file.
RULES: tuple[ProxyRule, ...] = (
    _rule("GET", r"/v1/api-keys", "admin"),
    _rule("POST", r"/v1/api-keys", "admin"),
    _rule("GET", r"/v1/access-policies", "operator"),
    _rule("POST", rf"/v1/access-policies/{_ID}/reset", "operator"),
    _rule("GET", r"/v1/signals"),
    _rule("GET", r"/v1/signals/summary"),
    _rule("GET", r"/v1/signals/export\.csv"),
    _rule("GET", r"/v1/tasks"),
    _rule("GET", r"/v1/sources/stats"),
    _rule("GET", r"/v1/stats/cost-estimate"),
    _rule("POST", rf"/v1/jobs/{_ID}/retry-dead", "operator"),
    _rule("DELETE", rf"/v1/api-keys/{_ID}", "admin"),
    _rule("GET", rf"/v1/articles/{_ID}"),
    _rule("GET", rf"/v1/articles/{_ID}/summaries"),
    _rule("GET", rf"/v1/artifacts/{_ID}/{_ID}"),
    _rule("GET", rf"/v1/companies/{_ID}"),
    _rule("POST", r"/v1/exports", "operator"),
    _rule("GET", rf"/v1/exports/{_ID}"),
    _rule("GET", r"/v1/finder/memory"),
    _rule("POST", r"/v1/jobs", "operator"),
    _rule("GET", r"/v1/jobs"),
    _rule("GET", rf"/v1/jobs/{_ID}"),
    _rule("GET", rf"/v1/jobs/{_ID}/articles"),
    _rule("POST", rf"/v1/jobs/{_ID}/cancel", "operator"),
    _rule("GET", rf"/v1/jobs/{_ID}/companies"),
    _rule("GET", rf"/v1/jobs/{_ID}/events"),
    _rule("GET", rf"/v1/jobs/{_ID}/export/{_TABLE}"),
    _rule("GET", rf"/v1/jobs/{_ID}/flags"),
    _rule("GET", rf"/v1/jobs/{_ID}/ranking"),
    _rule("POST", rf"/v1/jobs/{_ID}/resume", "operator"),
    _rule("GET", rf"/v1/jobs/{_ID}/sections"),
    _rule("GET", rf"/v1/jobs/{_ID}/signals"),
    _rule("GET", rf"/v1/jobs/{_ID}/site-runs"),
    _rule("GET", rf"/v1/jobs/{_ID}/sources"),
    _rule("GET", rf"/v1/jobs/{_ID}/summaries"),
    _rule("GET", rf"/v1/jobs/{_ID}/summary"),
    _rule("GET", rf"/v1/jobs/{_ID}/tasks"),
    _rule("GET", rf"/v1/site-runs/{_ID}/exploration"),
    _rule("GET", rf"/v1/site-runs/{_ID}/work"),
    _rule("GET", r"/v1/stats/daily"),
    _rule("POST", rf"/v1/tasks/{_ID}/retry", "operator"),
    _rule("GET", r"/v1/urls"),
    _rule("GET", r"/v1/workers"),
)


def match_rule(method: str, path: str) -> ProxyRule | None:
    """The first rule that matches the request, or None (→ 404 not_proxied)."""
    for rule in RULES:
        if rule.matches(method, path):
            return rule
    return None


def role_allowed(rule: ProxyRule, role: str) -> bool:
    return role_satisfies(role, rule.min_role)
