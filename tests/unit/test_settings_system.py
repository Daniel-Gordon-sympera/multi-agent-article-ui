"""System helpers (queue summation, dead-by-category) and prefs validation."""

from datetime import date

import pytest
from pydantic import ValidationError

from scout_bff.prefs.schema import DEFAULT_PREFS, PrefsPatch, sanitise_prefs
from scout_bff.system.maintenance import MAINTENANCE_JOBS, maintenance_schedule
from scout_bff.system.service import (
    dead_by_category,
    queue_from_counts,
    sum_queue_from_progress,
)

TODAY = date(2026, 10, 4)


def test_queue_from_recent_jobs_sums_progress_and_leaves_failed_unknown():
    details = [
        {"progress": {"tasks_pending": 9, "tasks_running": 2, "tasks_dead": 1}},
        {"progress": {"tasks_pending": 4, "tasks_running": 1, "tasks_dead": 0}},
        {"progress": None},
        {},
    ]
    assert sum_queue_from_progress(details) == {
        "queued": 13,
        "running": 3,
        "failed": None,
        "dead": 1,
        "basis": "recent_jobs",
        "jobs_scanned": 4,
    }


def test_queue_from_global_counts():
    assert queue_from_counts({"queued": 9, "running": 2, "dead": 1}) == {
        "queued": 9,
        "running": 2,
        "failed": 0,
        "dead": 1,
        "basis": "api",
        "jobs_scanned": 0,
    }


def test_dead_by_category_sums_the_window_and_ranks():
    rows = [
        {"day": "2026-10-04", "failures": {"model_rate_limited": 2, "task_timeout": 1}},
        {
            "day": "2026-10-01",
            "failures": {"model_rate_limited": 1, "network_error": 1},
        },
        {"day": "2026-09-30", "failures": {"saved_content_unavailable": 2}},
        {"day": "2026-09-20", "failures": {"model_rate_limited": 50}},  # outside
        {"day": "2026-10-02", "failures": "garbage"},
    ]
    result = dead_by_category(rows, TODAY, 7)
    assert result["days"] == 7 and result["since"] == "2026-09-28"
    assert result["total"] == 7
    assert result["items"] == [
        {"category": "model_rate_limited", "count": 3, "pct": 100},
        {"category": "saved_content_unavailable", "count": 2, "pct": 67},
        {"category": "network_error", "count": 1, "pct": 33},
        {"category": "task_timeout", "count": 1, "pct": 33},
    ]
    assert dead_by_category([], TODAY, 7)["items"] == []


def test_maintenance_schedule_is_static_with_null_results():
    schedule = maintenance_schedule()
    assert [row["name"] for row in schedule["items"]] == [
        "sweep_jobs",
        "expire_artifacts",
        "purge_work_items",
        "backup_database",
        "export_dataset",
    ]
    assert all(row["last_result"] is None for row in schedule["items"])
    assert len(schedule["items"]) == len(MAINTENANCE_JOBS)
    assert "not exposed" in schedule["note"]


def test_prefs_patch_accepts_partial_enum_values_only():
    assert PrefsPatch(theme="dark").as_patch() == {"theme": "dark"}
    assert PrefsPatch().as_patch() == {}
    with pytest.raises(ValidationError):
        PrefsPatch(theme="blue")
    with pytest.raises(ValidationError):
        PrefsPatch(landing="/sources")
    with pytest.raises(ValidationError):
        PrefsPatch(colour="x")  # type: ignore[call-arg]


def test_sanitise_prefs_drops_unknown_keys_and_values():
    stored = {"theme": "dark", "density": "huge", "legacy": 1, "landing": "/jobs"}
    assert sanitise_prefs(stored) == {"theme": "dark", "landing": "/jobs"}
    assert sanitise_prefs(None) == {} and sanitise_prefs("x") == {}
    assert {**DEFAULT_PREFS, **sanitise_prefs(stored)} == {
        "theme": "dark",
        "density": "comfortable",
        "time_display": "utc",
        "landing": "/jobs",
    }
