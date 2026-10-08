"""The query of `GET /app/signals*` (contract §4.4): parsing, normalisation, scopes."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

from scout_bff.batches.naming import batch_reference_prefix
from scout_bff.errors import Problem

# Cross-job filters forwarded to the backend; batch_id becomes a reference prefix.
ALL_FILTERS: tuple[str, ...] = (
    "signal",
    "materiality",
    "company_key",
    "hq_scope",
    "org_kind",
    "job_industry",
    "state",
    "county",
    "job_id",
    "batch_id",
    "industry",
    "revenue_bin",
    "date_after",
    "date_before",
    "q",
)
PAGING_PARAMETERS: tuple[str, ...] = ("limit", "after")
DEFAULT_LIMIT = 50
MAX_LIMIT = 200

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_UUID_FILTERS = ("job_id", "batch_id")


def _clean(value: str) -> str:
    return " ".join(value.split())


@dataclass(frozen=True)
class SignalsQuery:
    """Normalised filters plus the paging inputs of one request."""

    filters: dict[str, str]
    limit: int = DEFAULT_LIMIT
    after: str | None = None

    @classmethod
    def from_params(
        cls, params: Mapping[str, str], *, paging: bool = True
    ) -> SignalsQuery:
        """Validate the raw query string; unknown names → 422 like the API.

        `paging=False` (summary, export) ignores `limit`/`after` instead of failing,
        so the SPA can send the explorer's query string unchanged.
        """
        allowed = set(ALL_FILTERS) | set(PAGING_PARAMETERS)
        unknown = sorted(set(params) - allowed)
        if unknown:
            raise Problem(
                422,
                "unknown_filter",
                f"Unsupported filters: {', '.join(unknown)}.",
                errors=[
                    {"location": ["query", name], "message": "unknown filter"}
                    for name in unknown
                ],
            )
        filters: dict[str, str] = {}
        for name in ALL_FILTERS:
            raw = params.get(name)
            if raw is None:
                continue
            value = _clean(raw)
            if not value:
                continue
            filters[name] = _validate(name, value)
        limit = _parse_limit(params.get("limit")) if paging else DEFAULT_LIMIT
        after = params.get("after") if paging else None
        return cls(filters=filters, limit=limit, after=after or None)

    def forwarded(self, *, paging: bool = True) -> dict[str, str]:
        """Forward every filter; UI batches use their stable client reference prefix."""
        params = dict(self.filters)
        batch_id = params.pop("batch_id", None)
        if batch_id:
            params["client_reference_prefix"] = batch_reference_prefix(batch_id)
        if paging:
            params["limit"] = str(self.limit)
            if self.after:
                params["after"] = self.after
        return params


def _validate(name: str, value: str) -> str:
    if name in ("date_after", "date_before"):
        if not _DATE.match(value):
            raise Problem(
                422,
                "validation_error",
                f"{name} must be a date formatted YYYY-MM-DD.",
                errors=[{"location": ["query", name], "message": "invalid date"}],
            )
        return value
    if name in _UUID_FILTERS:
        try:
            return str(UUID(value))
        except ValueError:
            raise Problem(
                422,
                "validation_error",
                f"{name} must be a UUID.",
                errors=[{"location": ["query", name], "message": "invalid uuid"}],
            ) from None
    if name == "state":
        return value.upper()
    return value


def _parse_limit(raw: str | None) -> int:
    if raw is None or raw == "":
        return DEFAULT_LIMIT
    try:
        limit = int(raw)
    except ValueError:
        limit = 0
    if not 1 <= limit <= MAX_LIMIT:
        raise Problem(
            422,
            "validation_error",
            f"limit must be between 1 and {MAX_LIMIT}.",
            errors=[{"location": ["query", "limit"], "message": "out of range"}],
        )
    return limit
