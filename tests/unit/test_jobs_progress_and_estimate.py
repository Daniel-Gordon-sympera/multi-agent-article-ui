"""Pure parts of the jobs aggregate and the estimate: parsing, maths, caching."""

from datetime import datetime, timezone

import pytest

from scout_bff.errors import Problem
from scout_bff.estimate.service import EstimateCache
from scout_bff.jobs.progress import (
    ProgressCache,
    duration_seconds,
    parse_job_ids,
    site_counts,
    snapshot,
    total_cost_usd,
)

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


def test_estimate_cache_round_trip():
    cache = EstimateCache(ttl_seconds=60)
    key = ("location_industry", 5, "construction")
    assert cache.get(key) is None
    cache.put(key, {"samples": 0})
    assert cache.get(key) == {"samples": 0}
