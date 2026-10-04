"""Site-run rows for the stub pipeline API (used by /app/jobs/progress tests)."""

from __future__ import annotations

from typing import Any

from tests.pipeline_fixtures import JOB_ANALYSING, JOB_COMPLETED


def _site_run(
    job_id: str,
    rank: int,
    domain: str,
    status: str,
    *,
    stop_reason: str | None = None,
    finished: bool = True,
) -> dict[str, Any]:
    return {
        "id": f"5e1a2b3c-{rank:04d}-4b00-9000-{abs(hash(job_id)) % 10**12:012d}",
        "job_id": job_id,
        "seed_url": f"https://{domain}",
        "domain": domain,
        "title": domain.split(".")[0].title(),
        "rank": rank,
        "status": status,
        "stop_reason": stop_reason,
        "started_at": "2026-10-04T11:10:00+00:00",
        "finished_at": "2026-10-04T11:37:00+00:00" if finished else None,
        "stats": {
            "sections": 4,
            "pages": 38,
            "links": 10_070,
            "articles": 18,
            "fetches": 56,
            "bytes": 22_441_984,
            "tokens": 155_800,
        },
    }


SITE_RUNS: dict[str, list[dict[str, Any]]] = {
    JOB_ANALYSING: [
        _site_run(
            JOB_ANALYSING,
            1,
            "orlandomagazine.com",
            "finished",
            stop_reason="no_new_accepted_articles",
        ),
        _site_run(
            JOB_ANALYSING,
            2,
            "orlandosentinel.com",
            "finished",
            stop_reason="no_new_accepted_articles",
        ),
        _site_run(
            JOB_ANALYSING,
            3,
            "bizjournals.com/orlando",
            "partial",
            stop_reason="site_time_limit",
        ),
        _site_run(
            JOB_ANALYSING,
            4,
            "orlandoweekly.com",
            "no_sections",
            stop_reason="no_sections",
        ),
        _site_run(JOB_ANALYSING, 5, "growthspotter.com", "discovering", finished=False),
    ],
    JOB_COMPLETED: [
        _site_run(
            JOB_COMPLETED,
            1,
            "peachreport.com",
            "finished",
            stop_reason="no_new_accepted_articles",
        ),
        _site_run(
            JOB_COMPLETED,
            2,
            "ajc.com",
            "finished",
            stop_reason="no_new_accepted_articles",
        ),
    ],
}
