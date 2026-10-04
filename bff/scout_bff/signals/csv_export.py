"""Streamed CSV of the cross-job read: the pipeline signal columns + the job columns."""

from __future__ import annotations

import csv
import io
import json
from collections.abc import AsyncIterator, Iterable
from typing import Any

# The signal row of contract §1 (= the pipeline's signals.csv columns), in order.
SIGNAL_CSV_COLUMNS: tuple[str, ...] = (
    "id",
    "summary_id",
    "article_id",
    "company_id",
    "number_company",
    "name_as_written",
    "entity_type",
    "role",
    "quote_id",
    "evidence",
    "confidence_score",
    "confidence_level",
    "checks",
    "signal",
    "signal_title",
    "materiality",
    "connection",
    "signal_quote_id",
    "signal_evidence",
    "url",
    "title",
    "date",
    "source_domain",
    "article_key",
    "company_key",
    "company",
    "confidence",
    "fetch_status",
    "org_kind",
    "org_kind_basis",
    "hq_scope",
    "entity_flag",
    "hq_county",
    "hq_state",
    "scope_place",
    "scope_basis",
    "company_industry",
    "company_sub_industry",
    "industry_basis",
    "revenue_bin",
    "revenue_basis",
    "revenue_confidence",
    "enrichment_source",
)
JOB_CSV_COLUMNS: tuple[str, ...] = ("job_id", "county", "state", "job_industry")
EXPORT_COLUMNS: tuple[str, ...] = (*SIGNAL_CSV_COLUMNS, *JOB_CSV_COLUMNS)
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
CSV_FILENAME = "signals.csv"


def csv_cell(value: Any) -> str:
    """Scalars as text, lists/objects as JSON, None as an empty cell."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _line(values: Iterable[Any]) -> str:
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="\r\n").writerow(
        [csv_cell(value) for value in values]
    )
    return buffer.getvalue()


def header_line() -> str:
    return _line(EXPORT_COLUMNS)


def row_line(row: dict[str, Any]) -> str:
    """One CSV line; `state` is the job's `state_code` (contract §4.3 wording)."""
    values = [row.get(column) for column in SIGNAL_CSV_COLUMNS]
    values.extend(
        [
            row.get("job_id"),
            row.get("county"),
            row.get("state_code", row.get("state")),
            row.get("job_industry"),
        ]
    )
    return _line(values)


async def stream_csv(rows: AsyncIterator[dict[str, Any]]) -> AsyncIterator[bytes]:
    """Header first, then one encoded line per row as the rows arrive."""
    yield header_line().encode("utf-8")
    async for row in rows:
        yield row_line(row).encode("utf-8")


async def iterate_list(rows: list[dict[str, Any]]) -> AsyncIterator[dict[str, Any]]:
    for row in rows:
        yield row


def content_disposition(filename: str = CSV_FILENAME) -> str:
    return f'attachment; filename="{filename}"'
