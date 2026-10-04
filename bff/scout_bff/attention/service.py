"""Assemble the "Needs attention" items (contract §4.3) from bounded pipeline reads.

Sources: dead tasks (`GET /v1/tasks?status=dead` with capability `tasks_global`, else the
dead tasks of the 20 most recent non-terminal/partial jobs), partial and failed jobs of
the last 7 days, workers with slow or missing heartbeats, and the pipeline readiness.
Every source degrades on its own: a pipeline problem turns into an `api_not_ready` item
instead of failing the card.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from scout_bff.capabilities import CapabilityCache
from scout_bff.logging import get_logger
from scout_bff.overview.pipeline_reads import (
    NON_TERMINAL_STATUSES,
    RECENT_JOBS_FOR_FALLBACKS,
    created_at_key,
    fetch_job_details,
    fetch_job_resources,
    iso_days_ago,
    job_label,
    list_all_items,
    list_jobs_by_status,
    parse_timestamp,
    utc_now,
)
from scout_bff.pipeline_client import KeyRole, PipelineClient, PipelineError

logger = get_logger("scout_bff.attention")

WORKER_SLOW_SECONDS = 30
WORKER_MISSING_SECONDS = 90
RECENT_DAYS = 7
SEVERITY_RANK = {"fail": 0, "warn": 1}


def item(
    kind: str, severity: str, title: str, detail: str, href: str, **extra: Any
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "kind": kind,
        "severity": severity,
        "title": title,
        "detail": detail,
        "href": href,
    }
    row.update({key: value for key, value in extra.items() if value is not None})
    return row


def sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fail before warn; the original order is kept inside each severity."""
    return sorted(items, key=lambda row: SEVERITY_RANK.get(str(row["severity"]), 9))


def format_age(seconds: float) -> str:
    seconds = max(0, round(seconds))
    if seconds < 120:
        return f"{seconds} s ago"
    minutes = seconds // 60
    if minutes < 120:
        return f"{minutes} min ago"
    return f"{minutes // 60} h ago"


def dead_task_items(
    tasks_by_job: dict[str, list[dict[str, Any]]], jobs: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for job_id, tasks in tasks_by_job.items():
        if not tasks:
            continue
        kinds = sorted({str(task.get("kind") or "task") for task in tasks})
        categories = sorted(
            {
                str(task["error_category"])
                for task in tasks
                if task.get("error_category")
            }
        )
        count = len(tasks)
        noun = "dead task" if count == 1 else "dead tasks"
        title = f"{count} {noun} · {kinds[0]}" if len(kinds) == 1 else f"{count} {noun}"
        job = jobs.get(job_id)
        parts = [", ".join(categories) if categories else "error"]
        parts.append(job_label(job) if job else job_id[:8])
        items.append(
            item(
                "dead_task",
                "fail",
                title,
                " · ".join(parts),
                f"/jobs/{job_id}/tasks",
                job_id=job_id,
                task_id=int(tasks[0]["id"]) if count == 1 else None,
            )
        )
    return items


def partial_job_items(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        item(
            "partial_job",
            "warn",
            "Partial run waiting for a decision",
            f"{job_label(job)} · stopped on {job.get('stop_reason') or 'unknown'} · "
            "resume?",
            f"/jobs/{job['id']}",
            job_id=str(job["id"]),
        )
        for job in jobs
    ]


def failed_job_items(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        item(
            "failed_job",
            "fail",
            "Run failed",
            f"{job_label(job)} · {job.get('stop_reason') or 'no stop reason'}",
            f"/jobs/{job['id']}",
            job_id=str(job["id"]),
        )
        for job in jobs
    ]


def worker_items(workers: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    """`last_seen` older than 30 s → warn, older than 90 s → fail; gone workers skipped."""
    items: list[dict[str, Any]] = []
    for worker in workers:
        if worker.get("gone_at"):
            continue
        seen = parse_timestamp(worker.get("last_seen"))
        age = (now - seen).total_seconds() if seen else float("inf")
        if age <= WORKER_SLOW_SECONDS:
            continue
        instance = str(worker.get("instance_id") or "worker")
        missing = age > WORKER_MISSING_SECONDS
        seen_text = format_age(age) if seen else "never"
        items.append(
            item(
                "slow_worker",
                "fail" if missing else "warn",
                f"{instance} heartbeat is {'missing' if missing else 'slow'}",
                f"last seen {seen_text} · {worker.get('role') or 'worker'}",
                f"/settings/workers#{instance}",
                instance_id=instance,
            )
        )
    return items


def api_not_ready_item(detail: str) -> dict[str, Any]:
    return item(
        "api_not_ready", "fail", "Pipeline API is not ready", detail, "/settings/system"
    )


def readiness_detail(body: dict[str, Any]) -> str:
    checks = body.get("checks")
    if isinstance(checks, dict) and checks:
        failing = [name for name, value in checks.items() if value in (False, "fail")]
        if failing:
            return "failing checks: " + ", ".join(sorted(failing))
    return str(body.get("status") or "not_ready")


class AttentionBuilder:
    """Collects the items; each pipeline source may fail without failing the whole."""

    def __init__(
        self, pipeline: PipelineClient, capabilities: CapabilityCache, role: KeyRole
    ) -> None:
        self.pipeline = pipeline
        self.capabilities = capabilities
        self.role = role
        self.problems: list[str] = []

    async def build(self) -> dict[str, Any]:
        now = utc_now()
        items: list[dict[str, Any]] = []
        api_item = await self.readiness()
        if api_item:
            items.append(api_item)
        for source in (self.dead_tasks, self.partial_jobs, self.failed_jobs):
            try:
                items.extend(await source())
            except PipelineError as error:
                self.problems.append(error.category)
        try:
            items.extend(worker_items(await self.workers(), now))
        except PipelineError as error:
            self.problems.append(error.category)
        if self.problems and not api_item:
            items.append(
                api_not_ready_item("some reads failed: " + ", ".join(self.problems))
            )
        return {"items": sort_items(items), "generated_at": now.isoformat()}

    async def readiness(self) -> dict[str, Any] | None:
        try:
            body = await self.pipeline.readyz()
        except PipelineError as error:
            return api_not_ready_item(error.detail)
        if body.get("status") == "ready":
            return None
        return api_not_ready_item(readiness_detail(body))

    async def dead_tasks(self) -> list[dict[str, Any]]:
        if self.capabilities.capabilities.get("tasks_global"):
            tasks = await list_all_items(
                self.pipeline, "/v1/tasks", role=self.role, status="dead"
            )
            by_job: dict[str, list[dict[str, Any]]] = {}
            for task in tasks:
                by_job.setdefault(str(task.get("job_id") or ""), []).append(task)
            by_job.pop("", None)
            jobs = await fetch_job_details(self.pipeline, by_job, role=self.role)
            return dead_task_items(by_job, jobs)
        recent = await list_jobs_by_status(
            self.pipeline, (*NON_TERMINAL_STATUSES, "partial"), role=self.role
        )
        recent = sorted(recent, key=created_at_key, reverse=True)[
            :RECENT_JOBS_FOR_FALLBACKS
        ]
        jobs = {str(job["id"]): job for job in recent}
        by_job = await fetch_job_resources(
            self.pipeline, jobs, "tasks", role=self.role, status="dead"
        )
        return dead_task_items(by_job, jobs)

    async def partial_jobs(self) -> list[dict[str, Any]]:
        jobs = await list_jobs_by_status(
            self.pipeline,
            ("partial",),
            role=self.role,
            created_after=iso_days_ago(RECENT_DAYS),
        )
        return partial_job_items(jobs)

    async def failed_jobs(self) -> list[dict[str, Any]]:
        jobs = await list_jobs_by_status(
            self.pipeline,
            ("failed",),
            role=self.role,
            created_after=iso_days_ago(RECENT_DAYS),
        )
        return failed_job_items(jobs)

    async def workers(self) -> list[dict[str, Any]]:
        page = await self.pipeline.workers(role=self.role, limit=200)
        return [row for row in page.get("items", []) if isinstance(row, dict)]
