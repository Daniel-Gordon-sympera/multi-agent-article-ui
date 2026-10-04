"""Attention items: severity sorting, worker thresholds, dead-task grouping, wording."""

from datetime import datetime, timedelta, timezone

from scout_bff.attention.service import (
    dead_task_items,
    failed_job_items,
    format_age,
    partial_job_items,
    readiness_detail,
    sort_items,
    worker_items,
)

NOW = datetime(2026, 10, 4, 11, 31, 57, tzinfo=timezone.utc)
JOB = {
    "id": "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41",
    "county": "Orange",
    "state_code": "FL",
    "kind": "location_industry",
    "input": {"industry": "Construction"},
    "stop_reason": None,
}


def worker(instance: str, age_seconds: float, **extra) -> dict:
    return {
        "instance_id": instance,
        "role": "analysis",
        "last_seen": (NOW - timedelta(seconds=age_seconds)).isoformat(),
        "gone_at": None,
        **extra,
    }


def test_sort_items_puts_fail_before_warn_and_keeps_order():
    items = [
        {"severity": "warn", "title": "w1"},
        {"severity": "fail", "title": "f1"},
        {"severity": "warn", "title": "w2"},
        {"severity": "fail", "title": "f2"},
    ]
    assert [row["title"] for row in sort_items(items)] == ["f1", "f2", "w1", "w2"]


def test_worker_thresholds_30_and_90_seconds():
    items = worker_items(
        [
            worker("analysis-1", 5),
            worker("analysis-2", 47),
            worker("discovery-1", 400),
            worker("finder-1", 1000, gone_at="2026-10-04T10:00:00+00:00"),
            {"instance_id": "ghost", "role": "api", "last_seen": None, "gone_at": None},
        ],
        NOW,
    )
    by_instance = {row["instance_id"]: row for row in items}
    assert set(by_instance) == {"analysis-2", "discovery-1", "ghost"}
    slow = by_instance["analysis-2"]
    assert slow["severity"] == "warn" and slow["kind"] == "slow_worker"
    assert slow["title"] == "analysis-2 heartbeat is slow"
    assert slow["detail"] == "last seen 47 s ago · analysis"
    assert slow["href"] == "/settings/workers#analysis-2"
    missing = by_instance["discovery-1"]
    assert missing["severity"] == "fail"
    assert missing["title"] == "discovery-1 heartbeat is missing"
    assert missing["detail"] == "last seen 6 min ago · analysis"
    assert by_instance["ghost"]["detail"] == "last seen never · api"


def test_format_age_units():
    assert format_age(47) == "47 s ago"
    assert format_age(119) == "119 s ago"
    assert format_age(125) == "2 min ago"
    assert format_age(3 * 3600) == "3 h ago"


def test_dead_task_items_group_per_job():
    tasks = {
        JOB["id"]: [
            {
                "id": 48920,
                "kind": "analyze_article",
                "error_category": "saved_content_unavailable",
            }
        ],
        "other-job": [
            {
                "id": 1,
                "kind": "analyze_article",
                "error_category": "model_rate_limited",
            },
            {"id": 2, "kind": "discover_site", "error_category": "task_timeout"},
        ],
        "empty-job": [],
    }
    items = dead_task_items(tasks, {JOB["id"]: JOB})
    assert len(items) == 2
    single, grouped = items
    assert single["title"] == "1 dead task · analyze_article"
    assert (
        single["detail"]
        == "saved_content_unavailable · Orange County, FL · Construction"
    )
    assert single["href"] == f"/jobs/{JOB['id']}/tasks"
    assert single["task_id"] == 48920 and single["job_id"] == JOB["id"]
    assert single["severity"] == "fail" and single["kind"] == "dead_task"
    assert grouped["title"] == "2 dead tasks"
    assert grouped["detail"] == "model_rate_limited, task_timeout · other-jo"
    assert "task_id" not in grouped


def test_partial_and_failed_job_items():
    partial = partial_job_items(
        [{**JOB, "status": "partial", "stop_reason": "site_time_limit"}]
    )
    assert partial[0]["severity"] == "warn" and partial[0]["kind"] == "partial_job"
    assert partial[0]["title"] == "Partial run waiting for a decision"
    assert partial[0]["detail"] == (
        "Orange County, FL · Construction · stopped on site_time_limit · resume?"
    )
    assert partial[0]["href"] == f"/jobs/{JOB['id']}"
    failed = failed_job_items(
        [{**JOB, "status": "failed", "stop_reason": "no_sources_found"}]
    )
    assert failed[0]["severity"] == "fail" and failed[0]["kind"] == "failed_job"
    assert failed[0]["detail"] == "Orange County, FL · Construction · no_sources_found"


def test_readiness_detail_names_failing_checks():
    assert readiness_detail(
        {"status": "not_ready", "checks": {"database": True, "migrations": False}}
    ) == ("failing checks: migrations")
    assert readiness_detail({"status": "not_ready", "checks": {}}) == "not_ready"
