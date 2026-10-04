"""Pure functions behind the Overview tiles (mockup §3.1): series, deltas, counts.

Every function takes plain rows and an explicit `today` so unit tests are deterministic.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from scout_bff.overview.pipeline_reads import (
    RUNNING_TILE_STATUSES,
    SITE_RUN_DONE_STATUSES,
    parse_timestamp,
)

SERIES_DAYS = 14
WINDOW_DAYS = 7


def running_jobs_summary(jobs: list[dict[str, Any]], scouts: int) -> dict[str, Any]:
    by_status = {status: 0 for status in RUNNING_TILE_STATUSES}
    for job in jobs:
        status = str(job.get("status") or "")
        if status in by_status:
            by_status[status] += 1
    return {"total": len(jobs), "by_status": by_status, "scouts": scouts}


def rows_by_day(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        day = str(row.get("day") or "")[:10]
        if day:
            indexed[day] = row
    return indexed


def day_keys(today: date, days: int) -> list[str]:
    """Oldest → newest, `days` entries ending today."""
    return [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(days - 1, -1, -1)
    ]


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def series_of(
    rows: list[dict[str, Any]], today: date, column: str, days: int = SERIES_DAYS
) -> list[float]:
    """Daily values for the last `days` days; missing days count as 0."""
    indexed = rows_by_day(rows)
    series: list[float] = []
    for day in day_keys(today, days):
        row = indexed.get(day)
        value = _number(row.get(column)) if row else None
        series.append(value or 0.0)
    return series


def window_sum(
    rows: list[dict[str, Any]], today: date, column: str, *, back: int
) -> float:
    """Sum of `column` over the 7 days ending `back` days before today (0 = this week)."""
    indexed = rows_by_day(rows)
    end = today - timedelta(days=back)
    total = 0.0
    for offset in range(WINDOW_DAYS):
        row = indexed.get((end - timedelta(days=offset)).isoformat())
        if row:
            total += _number(row.get(column)) or 0.0
    return total


def percent_delta(current: float, previous: float) -> int | None:
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100)


def signals_summary(rows: list[dict[str, Any]], today: date) -> dict[str, Any]:
    current = window_sum(rows, today, "signals", back=0)
    previous = window_sum(rows, today, "signals", back=WINDOW_DAYS)
    return {
        "count": int(current),
        "delta_pct": percent_delta(current, previous),
        "series": [int(value) for value in series_of(rows, today, "signals")],
    }


def _day_cost(row: dict[str, Any] | None) -> tuple[float | None, bool]:
    """(cost_usd or None when incomplete, cost_complete)."""
    if row is None:
        return 0.0, True
    complete = row.get("cost_complete")
    complete = True if complete is None else bool(complete)
    cost = _number(row.get("cost_usd"))
    if cost is None and complete:
        cost = _number(row.get("known_cost_usd"))
    return cost, complete


def cost_summary(rows: list[dict[str, Any]], today: date) -> dict[str, Any]:
    indexed = rows_by_day(rows)
    usd, complete = _day_cost(indexed.get(today.isoformat()))
    yesterday, _ = _day_cost(indexed.get((today - timedelta(days=1)).isoformat()))
    series: list[float] = []
    for day in day_keys(today, SERIES_DAYS):
        row = indexed.get(day)
        value = None
        if row:
            value = _number(row.get("cost_usd"))
            if value is None:
                value = _number(row.get("known_cost_usd"))
        series.append(round(value or 0.0, 4))
    delta = None if usd is None or yesterday is None else round(usd - yesterday, 4)
    return {
        "usd": None if usd is None else round(usd, 4),
        "delta_usd": delta,
        "series": series,
        "cost_complete": complete,
    }


def failures_total(row: dict[str, Any] | None) -> int:
    failures = row.get("failures") if row else None
    if not isinstance(failures, dict):
        return 0
    return int(sum(_number(count) or 0 for count in failures.values()))


def dead_tasks_from_failures(rows: list[dict[str, Any]], today: date) -> dict[str, Any]:
    """Fallback without `tasks_global`: failures of the last 7 days, today's as new."""
    indexed = rows_by_day(rows)
    total = sum(
        failures_total(indexed.get((today - timedelta(days=offset)).isoformat()))
        for offset in range(WINDOW_DAYS)
    )
    return {
        "count": total,
        "new_since_yesterday": failures_total(indexed.get(today.isoformat())),
        "basis": "daily_stats",
    }


def dead_tasks_from_tasks(tasks: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    """With `tasks_global`: the dead rows themselves; new = finished in the last 24 h."""
    since = now - timedelta(hours=24)
    new = 0
    for task in tasks:
        stamp = parse_timestamp(task.get("finished_at")) or parse_timestamp(
            task.get("created_at")
        )
        if stamp and stamp >= since:
            new += 1
    return {"count": len(tasks), "new_since_yesterday": new, "basis": "api"}


def job_cost(detail: dict[str, Any]) -> tuple[float | None, bool]:
    """Sum of the per-stage costs; None + False when a stage lacks pricing."""
    costs = detail.get("costs")
    if not isinstance(costs, list):
        return None, False
    total = 0.0
    complete = True
    for row in costs:
        if not isinstance(row, dict):
            continue
        value = _number(row.get("cost_usd"))
        if value is None:
            complete = False
            total += _number(row.get("known_cost_usd")) or 0.0
        else:
            total += value
    return (round(total, 4) if complete else None), complete


def sites_summary(
    detail: dict[str, Any], site_runs: list[dict[str, Any]] | None
) -> dict[str, int | None]:
    progress = (
        detail.get("progress") if isinstance(detail.get("progress"), dict) else {}
    )
    seeds = int(_number(progress.get("seeds")) or 0)
    if site_runs is None:
        return {"done": None, "total": seeds or None}
    done = sum(
        1 for run in site_runs if str(run.get("status")) in SITE_RUN_DONE_STATUSES
    )
    return {"done": done, "total": max(seeds, len(site_runs))}
