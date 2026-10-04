"""Rows for the stub pipeline API, shaped like contract §1 and the mockup data."""

from __future__ import annotations

from typing import Any

PIPELINE_URL = "http://pipeline-stub.test"
OPERATOR_KEY = "sympera_stub-operator-key-0123456789abcdef"
READER_KEY = "sympera_stub-reader-key-0123456789abcdef"
PROMPT_VERSION = "2026.10"

JOB_ANALYSING = "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41"
JOB_DISCOVERING = "0192f1c3-7e0a-4c1b-9d33-5a1e8b2f0c42"
JOB_QUEUED = "0192ef10-7e0a-4c1b-9d33-5a1e8b2f0c43"
JOB_PARTIAL = "0192ee55-7e0a-4c1b-9d33-5a1e8b2f0c44"
JOB_COMPLETED = "0192ea31-7e0a-4c1b-9d33-5a1e8b2f0c45"
JOB_FAILED = "0192e8c0-7e0a-4c1b-9d33-5a1e8b2f0c46"

DEAD_TASK_ID = 48920
RUNNING_TASK_ID = 48911
SUCCEEDED_TASK_ID = 48902

SETTINGS = {
    "days": 30,
    "sites": 5,
    "site_timeout": 0,
    "max_runtime": 18000,
    "memory_mode": "full",
    "reanalyze": False,
}


def _job(
    job_id: str,
    county: str,
    state: str,
    industry: str | None,
    status: str,
    created_at: str,
    *,
    kind: str = "location_industry",
    stop_reason: str | None = None,
    client_reference: str | None = None,
    signals: int = 0,
) -> dict[str, Any]:
    if kind == "location_industry":
        job_input = {"location": f"{county}, {state}", "industry": industry}
    else:
        job_input = {"seeds": [{"title": "Seed", "url": "https://example.com"}]}
    terminal = status in {"completed", "partial", "failed", "cancelled"}
    return {
        "id": job_id,
        "kind": kind,
        "input": job_input,
        "county": county,
        "state_code": state,
        "settings": dict(SETTINGS),
        "prompt_version": PROMPT_VERSION,
        "status": status,
        "stop_reason": stop_reason,
        "client_reference": client_reference,
        "created_by": "daniel-ops",
        "created_at": created_at,
        "started_at": created_at if status != "queued" else None,
        "deadline_at": None,
        "finished_at": created_at if terminal else None,
        "summary": {"signals": signals} if terminal else None,
        "sessions": [{"started_at": created_at, "ended_at": None}],
        "progress": {
            "seeds": 5,
            "sections": 11,
            "pages": 99,
            "links": 26300,
            "articles": 40,
            "summaries": 31,
            "companies": 139,
            "signals": signals,
            "tasks_pending": 9,
            "tasks_running": 2,
            "tasks_dead": 1 if job_id == JOB_ANALYSING else 0,
        },
        "costs": [
            {
                "stage": "classification",
                "calls": 145,
                "input_tokens": 500000,
                "output_tokens": 112000,
                "total_tokens": 612000,
                "cost_usd": 1.21,
                "known_cost_usd": 1.21,
                "unpriced_calls": 0,
                "unknown_usage_calls": 0,
            }
        ],
    }


JOBS: list[dict[str, Any]] = [
    _job(
        JOB_FAILED,
        "Cook",
        "IL",
        "Utilities",
        "failed",
        "2026-10-01T14:05:00+00:00",
        stop_reason="no_sources_found",
    ),
    _job(
        JOB_COMPLETED,
        "Fulton",
        "GA",
        "Wholesale Trade",
        "completed",
        "2026-10-02T09:30:00+00:00",
        signals=18,
    ),
    _job(
        JOB_PARTIAL,
        "Maricopa",
        "AZ",
        None,
        "partial",
        "2026-10-03T16:10:00+00:00",
        kind="seeds",
        stop_reason="site_time_limit",
        signals=9,
    ),
    _job(
        JOB_QUEUED,
        "Harris",
        "TX",
        "Manufacturing",
        "queued",
        "2026-10-04T11:29:00+00:00",
    ),
    _job(
        JOB_ANALYSING,
        "Orange",
        "FL",
        "Construction",
        "analysing",
        "2026-10-04T11:02:00+00:00",
        client_reference="scout-7-2026-10-04",
        signals=24,
    ),
    _job(
        JOB_DISCOVERING,
        "Orange",
        "FL",
        "Manufacturing",
        "discovering",
        "2026-10-04T11:02:30+00:00",
        signals=3,
    ),
]


def _task(
    task_id: int, job_id: str, kind: str, status: str, **extra: Any
) -> dict[str, Any]:
    row = {
        "id": task_id,
        "kind": kind,
        "payload": {"job_id": job_id},
        "job_id": job_id,
        "site_run_id": None,
        "parent_task_id": None,
        "dedupe_key": f"{kind}:{task_id}",
        "status": status,
        "priority": 0,
        "run_after": None,
        "attempts": 1,
        "max_attempts": 4,
        "lease_until": None,
        "claimed_by": "analysis-1",
        "last_error": None,
        "error_category": None,
        "result": None,
        "created_at": "2026-10-04T11:20:00+00:00",
        "started_at": "2026-10-04T11:21:00+00:00",
        "finished_at": None,
    }
    row.update(extra)
    return row


TASKS: list[dict[str, Any]] = [
    _task(48811, JOB_ANALYSING, "find_sources", "succeeded"),
    _task(SUCCEEDED_TASK_ID, JOB_ANALYSING, "analyze_article", "succeeded"),
    _task(RUNNING_TASK_ID, JOB_ANALYSING, "analyze_article", "running"),
    _task(
        DEAD_TASK_ID,
        JOB_ANALYSING,
        "analyze_article",
        "dead",
        attempts=4,
        last_error="text artifact 410 (expired)",
        error_category="saved_content_unavailable",
    ),
    _task(48930, JOB_ANALYSING, "finalize_job", "queued", attempts=0),
]


SIGNALS_CSV_COLUMNS = [
    "company",
    "signal",
    "signal_title",
    "materiality",
    "confidence",
    "evidence",
    "url",
    "title",
    "date",
    "source_domain",
]
