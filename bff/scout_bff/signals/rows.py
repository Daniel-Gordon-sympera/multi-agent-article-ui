"""Pure row functions of the cross-job read: decorate, filter, sort, page, summarise."""

from __future__ import annotations

from collections import Counter
from typing import Any

JOB_COLUMNS: tuple[str, ...] = (
    "job_id",
    "county",
    "state_code",
    "job_industry",
    "job_created_at",
)
# Free text (`q`) searches these columns, case-insensitively.
FREE_TEXT_COLUMNS: tuple[str, ...] = (
    "company",
    "name_as_written",
    "evidence",
    "signal_evidence",
    "signal",
    "signal_title",
    "source_domain",
)
MATERIALITY_LEVELS: tuple[str, ...] = ("high", "medium", "low")


def _text(value: Any) -> str:
    return "" if value is None else str(value)


def job_industry(job: dict[str, Any]) -> str | None:
    """`input.industry` of a location_industry job; None for url/seeds jobs."""
    job_input = job.get("input")
    if isinstance(job_input, dict):
        industry = job_input.get("industry")
        if isinstance(industry, str) and industry.strip():
            return industry
    return None


def job_matches(job: dict[str, Any], job_filters: dict[str, str]) -> bool:
    """state / county / job_industry / job_id are exact (case-insensitive) matches."""
    checks = {
        "state": _text(job.get("state_code")),
        "county": _text(job.get("county")),
        "job_industry": _text(job_industry(job)),
        "job_id": _text(job.get("id")),
    }
    for name, expected in job_filters.items():
        if name not in checks:
            continue
        if checks[name].strip().lower() != expected.strip().lower():
            return False
    return True


def decorate_row(row: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    """A per-job signal row plus the job columns of contract §4.4."""
    return {
        **row,
        "job_id": job.get("id"),
        "county": job.get("county"),
        "state_code": job.get("state_code"),
        "job_industry": job_industry(job),
        "job_created_at": job.get("created_at"),
    }


def normalise_global_row(row: dict[str, Any]) -> dict[str, Any]:
    """Rows of `GET /v1/signals` (B1) may spell the job state `job_state`."""
    if "state_code" not in row and "job_state" in row:
        row = {**row, "state_code": row.get("job_state")}
    return row


def matches_row_filters(row: dict[str, Any], row_filters: dict[str, str]) -> bool:
    industry = row_filters.get("industry")
    if industry and _text(row.get("company_industry")).lower() != industry.lower():
        return False
    revenue_bin = row_filters.get("revenue_bin")
    if revenue_bin and _text(row.get("revenue_bin")).lower() != revenue_bin.lower():
        return False
    date = _text(row.get("date"))[:10]
    date_after = row_filters.get("date_after")
    if date_after and (not date or date < date_after):
        return False
    date_before = row_filters.get("date_before")
    if date_before and (not date or date > date_before):
        return False
    return True


def matches_free_text(row: dict[str, Any], needle: str | None) -> bool:
    if not needle:
        return True
    lowered = needle.lower()
    return any(
        lowered in _text(row.get(column)).lower() for column in FREE_TEXT_COLUMNS
    )


def filter_rows(
    rows: list[dict[str, Any]], row_filters: dict[str, str], free_text: str | None
) -> list[dict[str, Any]]:
    return [
        row
        for row in rows
        if matches_row_filters(row, row_filters) and matches_free_text(row, free_text)
    ]


def _row_id(row: dict[str, Any]) -> int:
    try:
        return int(row.get("id") or 0)
    except (TypeError, ValueError):
        return 0


def sort_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Article date descending, then mention id descending (contract §4.4)."""
    return sorted(
        rows, key=lambda row: (_text(row.get("date")), _row_id(row)), reverse=True
    )


def page_rows(
    rows: list[dict[str, Any]], offset: int, limit: int
) -> tuple[list[dict[str, Any]], int | None]:
    """One offset page and the offset of the next one (None at the end)."""
    offset = max(0, offset)
    page = rows[offset : offset + limit]
    next_offset = offset + limit if offset + limit < len(rows) else None
    return page, next_offset


def summarise(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Counts of `GET /app/signals/summary`: signals, companies, jobs, materiality, top."""
    companies = {
        _text(row.get("company_key")) or _text(row.get("company")).lower()
        for row in rows
    }
    jobs = {_text(row.get("job_id")) for row in rows if row.get("job_id")}
    by_materiality = {level: 0 for level in MATERIALITY_LEVELS}
    for row in rows:
        level = _text(row.get("materiality")).strip().lower()
        if level in by_materiality:
            by_materiality[level] += 1
    counter: Counter[str] = Counter()
    titles: dict[str, str] = {}
    for row in rows:
        key = _text(row.get("signal")).strip()
        if not key:
            continue
        counter[key] += 1
        titles.setdefault(key, _text(row.get("signal_title")).strip() or key)
    top_signal = None
    if counter:
        key, count = sorted(counter.items(), key=lambda item: (-item[1], item[0]))[0]
        top_signal = {"key": key, "title": titles[key], "count": count}
    return {
        "signals": len(rows),
        "companies": len(companies - {""}),
        "jobs": len(jobs),
        "by_materiality": by_materiality,
        "top_signal": top_signal,
    }
