"""Pure parts of the jobs aggregate and the estimate: parsing, maths, caching."""

from datetime import datetime, timezone

import pytest

from scout_bff.errors import Problem
from scout_bff.estimate.service import (
    EstimateCache,
    known_cost,
    matches,
    median,
    percentile_90,
    summarise,
)
from scout_bff.jobs.progress import (
    ProgressCache,
    duration_seconds,
    parse_job_ids,
    site_counts,
    snapshot,
    total_cost_usd,
)
from scout_bff.jobs.retry_dead import normalise_result

NOW = datetime(2026, 10, 4, 11, 31, tzinfo=timezone.utc)


def test_parse_job_ids_dedupes_and_caps():
    assert parse_job_ids("a, b,a,,c") == ["a", "b", "c"]
    assert parse_job_ids("") == []
    with pytest.raises(Problem) as excinfo:
        parse_job_ids(",".join(f"job-{n}" for n in range(51)))
    assert excinfo.value.status_code == 422
    assert excinfo.value.category == "too_many_job_ids"


def test_snapshot_sums_costs_counts_sites_and_measures_duration():
    job = {
        "status": "analysing",
        "progress": {"articles": 40},
        "costs": [
            {"cost_usd": 1.21, "known_cost_usd": 1.21},
            {"cost_usd": None, "known_cost_usd": 0.5},
        ],
        "started_at": "2026-10-04T11:02:00+00:00",
        "finished_at": None,
    }
    runs = [{"status": "finished"}, {"status": "partial"}, {"status": "discovering"}]
    assert total_cost_usd(job["costs"]) == 1.71
    assert total_cost_usd([]) is None
    assert site_counts(runs) == (2, 3)
    assert duration_seconds(job, NOW) == 29 * 60
    assert duration_seconds({"started_at": None}, NOW) is None
    assert snapshot(job, runs, NOW) == {
        "status": "analysing",
        "progress": {"articles": 40},
        "cost_usd": 1.71,
        "sites_total": 3,
        "sites_done": 2,
        "duration_seconds": 1740.0,
    }


def test_progress_cache_expires_entries():
    cache = ProgressCache(ttl_seconds=5)
    cache.put("a", {"status": "queued"}, at=100.0)
    assert cache.get("a", at=104.9) == {"status": "queued"}
    assert cache.get("a", at=105.0) is None


def test_normalise_retry_result_accepts_every_shape():
    assert normalise_result({"retried": 2, "task_ids": [1, 2]}) == {
        "retried": 2,
        "task_ids": [1, 2],
        "skipped_task_ids": [],
    }
    assert normalise_result({"task_ids": ["7", 8]}) == {
        "retried": 1,
        "task_ids": [8],
        "skipped_task_ids": [],
    }
    assert normalise_result("garbage") == {
        "retried": 0,
        "task_ids": [],
        "skipped_task_ids": [],
    }
    assert normalise_result({"retried": 2}, requested=[5, 6])["task_ids"] == [5, 6]


def test_estimate_statistics_and_matching():
    assert median([3.0, 1.0, 2.0]) == 2.0
    assert median([1.0, 2.0, 3.0, 4.0]) == 2.5
    assert percentile_90([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]) == 9.0
    assert percentile_90([4.2]) == 4.2
    assert known_cost([{"known_cost_usd": 1.5}, {"known_cost_usd": None}]) == 1.5
    assert known_cost([]) is None
    job = {
        "kind": "location_industry",
        "status": "completed",
        "input": {"industry": "Wholesale Trade"},
        "settings": {"sites": 5},
    }
    assert matches(job, "location_industry", None, None)
    assert matches(job, "location_industry", 5, "wholesale trade")
    assert not matches(job, "location_industry", 3, None)
    assert not matches(job, "seeds", None, None)
    assert not matches({**job, "status": "partial"}, "location_industry", None, None)
    assert summarise([], "recent_jobs") == {"samples": 0}
    assert summarise([2.0, 4.0], "api") == {
        "median_cost_usd": 3.0,
        "p90_cost_usd": 4.0,
        "samples": 2,
        "basis": "api",
    }


def test_estimate_cache_round_trip():
    cache = EstimateCache(ttl_seconds=60)
    key = ("location_industry", 5, "construction")
    assert cache.get(key) is None
    cache.put(key, {"samples": 0})
    assert cache.get(key) == {"samples": 0}
