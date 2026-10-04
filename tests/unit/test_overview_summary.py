"""Overview tiles: series, deltas, running/dead counts, active-run rows; the TTL cache."""

from datetime import date, datetime, timedelta, timezone

import pytest

from scout_bff.overview.cache import TtlCache
from scout_bff.overview.pipeline_reads import job_label, job_target
from scout_bff.overview.summary import (
    cost_summary,
    dead_tasks_from_failures,
    dead_tasks_from_tasks,
    job_cost,
    percent_delta,
    running_jobs_summary,
    series_of,
    signals_summary,
    sites_summary,
)

TODAY = date(2026, 10, 4)


def daily_rows(signals_by_offset: dict[int, int]) -> list[dict]:
    return [
        {
            "day": (TODAY - timedelta(days=offset)).isoformat(),
            "signals": count,
            "cost_usd": round(count / 10, 2),
            "known_cost_usd": round(count / 10, 2),
            "cost_complete": True,
            "failures": {"model_rate_limited": 1} if count > 15 else {},
        }
        for offset, count in signals_by_offset.items()
    ]


def test_running_jobs_summary_counts_the_six_tile_statuses():
    jobs = [
        {"status": "queued"},
        {"status": "queued"},
        {"status": "analysing"},
        {"status": "finalizing"},
        {"status": "cancelling"},
        {"status": "bogus"},
    ]
    summary = running_jobs_summary(jobs, scouts=3)
    assert summary["total"] == 6 and summary["scouts"] == 3
    assert summary["by_status"] == {
        "queued": 2,
        "finding": 0,
        "exploring": 0,
        "discovering": 0,
        "analysing": 1,
        "finalizing": 1,
    }


def test_series_fills_missing_days_oldest_first():
    rows = daily_rows({0: 24, 1: 18, 13: 7})
    series = series_of(rows, TODAY, "signals")
    assert len(series) == 14
    assert series[0] == 7 and series[-2] == 18 and series[-1] == 24
    assert series[1:12] == [0.0] * 11


def test_signals_summary_windows_and_delta():
    this_week = {offset: 10 for offset in range(7)}
    last_week = {offset: 5 for offset in range(7, 14)}
    summary = signals_summary(daily_rows({**this_week, **last_week}), TODAY)
    assert summary["count"] == 70
    assert summary["delta_pct"] == 100
    assert summary["series"] == [5] * 7 + [10] * 7


def test_percent_delta_is_null_without_a_previous_window():
    assert percent_delta(10, 0) is None
    assert percent_delta(90, 100) == -10
    assert signals_summary([], TODAY) == {
        "count": 0,
        "delta_pct": None,
        "series": [0] * 14,
    }


def test_cost_summary_today_delta_and_incomplete_pricing():
    rows = daily_rows({0: 20, 1: 10})
    summary = cost_summary(rows, TODAY)
    assert summary["usd"] == 2.0 and summary["delta_usd"] == 1.0
    assert summary["cost_complete"] is True
    assert summary["series"][-2:] == [1.0, 2.0]

    rows[0]["cost_usd"] = None
    rows[0]["cost_complete"] = False
    rows[0]["known_cost_usd"] = 1.5
    incomplete = cost_summary(rows, TODAY)
    assert incomplete["usd"] is None and incomplete["delta_usd"] is None
    assert incomplete["cost_complete"] is False
    assert incomplete["series"][-1] == 1.5  # known cost keeps the sparkline honest

    assert cost_summary([], TODAY) == {
        "usd": 0.0,
        "delta_usd": 0.0,
        "series": [0.0] * 14,
        "cost_complete": True,
    }


def test_dead_tasks_from_failures_sums_seven_days_and_today():
    rows = daily_rows({0: 20, 1: 20, 6: 20, 7: 20, 9: 20})
    result = dead_tasks_from_failures(rows, TODAY)
    assert result == {"count": 3, "new_since_yesterday": 1, "basis": "daily_stats"}


def test_dead_tasks_from_global_tasks_counts_the_last_24_hours():
    now = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)
    tasks = [
        {"id": 1, "finished_at": "2026-10-04T11:00:00+00:00"},
        {"id": 2, "finished_at": None, "created_at": "2026-10-03T13:00:00Z"},
        {"id": 3, "finished_at": "2026-10-01T09:00:00+00:00"},
        {"id": 4},
    ]
    assert dead_tasks_from_tasks(tasks, now) == {
        "count": 4,
        "new_since_yesterday": 2,
        "basis": "api",
    }


def test_job_cost_and_sites_summary():
    detail = {
        "progress": {"seeds": 5},
        "costs": [
            {"cost_usd": 1.21, "known_cost_usd": 1.21},
            {"cost_usd": 1.04, "known_cost_usd": 1.04},
        ],
    }
    assert job_cost(detail) == (2.25, True)
    detail["costs"].append({"cost_usd": None, "known_cost_usd": 0.4})
    assert job_cost(detail) == (None, False)
    site_runs = [
        {"status": "finished"},
        {"status": "partial"},
        {"status": "discovering"},
        {"status": "no_sections"},
    ]
    assert sites_summary(detail, site_runs) == {"done": 3, "total": 5}
    assert sites_summary(detail, None) == {"done": None, "total": 5}
    assert sites_summary({"progress": {"seeds": 0}}, None) == {
        "done": None,
        "total": None,
    }


def test_job_label_matches_the_web_wording():
    assert (
        job_label(
            {
                "county": "Orange",
                "state_code": "FL",
                "kind": "location_industry",
                "input": {"industry": "Construction"},
            }
        )
        == "Orange County, FL · Construction"
    )
    assert job_target({"kind": "seeds", "input": {"seeds": [{}, {}, {}]}}) == "3 seeds"
    assert (
        job_target(
            {"kind": "url", "input": {"url": "https://www.orlandomagazine.com/x"}}
        )
        == "orlandomagazine.com"
    )
    assert job_label(
        {"county": "Cook County", "state_code": "il", "kind": "seeds"}
    ) == ("Cook County, IL · 0 seeds")


async def test_ttl_cache_single_flight_and_expiry():
    clock = {"now": 100.0}
    cache = TtlCache(clock=lambda: clock["now"])
    calls = {"n": 0}

    async def compute() -> dict:
        calls["n"] += 1
        return {"value": calls["n"]}

    first = await cache.get_or_compute("k", 10, compute)
    second = await cache.get_or_compute("k", 10, compute)
    assert first == second == {"value": 1} and calls["n"] == 1
    clock["now"] = 111.0
    third = await cache.get_or_compute("k", 10, compute)
    assert third == {"value": 2}
    cache.invalidate("k")
    assert cache.peek("k") is None

    async def failing() -> dict:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await cache.get_or_compute("fail", 10, failing)
    assert cache.peek("fail") is None
