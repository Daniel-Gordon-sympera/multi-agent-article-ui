"""Result rows for the stub pipeline API: signals, workers, stats, finder memory."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from tests.pipeline_fixtures import JOB_ANALYSING, JOB_COMPLETED, JOBS, TASKS


def _signal(
    signal_id: int,
    job_id: str,
    company: str,
    signal: str,
    title: str,
    materiality: str,
    evidence: str,
    date: str,
    domain: str,
    **flags: Any,
) -> dict[str, Any]:
    key = company.lower().replace(" ", "-").replace(".", "")
    row = {
        "id": signal_id,
        "summary_id": 9000 + signal_id,
        "article_id": 71300 + signal_id,
        "company_id": 5000 + signal_id,
        "number_company": 1,
        "name_as_written": company,
        "entity_type": "business",
        "role": "subject",
        "quote_id": 3,
        "evidence": evidence,
        "confidence_score": 0.9,
        "confidence_level": "high",
        "checks": {"verbatim": True, "name_grounded": True},
        "signal": signal,
        "signal_title": title,
        "materiality": materiality,
        "connection": "direct",
        "signal_quote_id": 3,
        "signal_evidence": evidence,
        "url": f"https://{domain}/article-{signal_id}",
        "title": f"Article {signal_id}",
        "date": date,
        "source_domain": domain,
        "article_key": f"a{signal_id}",
        "company_key": key,
        "company": company,
        "confidence": "high",
        "fetch_status": "ok",
        "org_kind": "business",
        "org_kind_basis": "name_cue",
        "hq_scope": "local",
        "entity_flag": "local",
        "hq_county": "Orange",
        "hq_state": "FL",
        "scope_place": "Orlando",
        "scope_basis": "article",
        "company_industry": "Construction",
        "company_sub_industry": "Nonresidential building",
        "industry_basis": "rules",
        "revenue_bin": "$10M-$20M",
        "revenue_basis": "explicit_figure",
        "revenue_confidence": "high",
        "enrichment_source": "rules_v1",
    }
    row.update(flags)
    return row


SIGNALS: dict[str, list[dict[str, Any]]] = {
    JOB_ANALYSING: [
        _signal(
            1,
            JOB_ANALYSING,
            "Lakeview Builders Group",
            "major_contract_awarded",
            "Major Contract Awarded",
            "high",
            "Lakeview Builders Group was awarded the $42 million contract to build "
            "the new Kirkman Road logistics center.",
            "2026-10-02",
            "orlandomagazine.com",
        ),
        _signal(
            2,
            JOB_ANALYSING,
            "Central Florida Concrete",
            "operational_capacity_expansion",
            "Operational Capacity Expansion",
            "high",
            "Central Florida Concrete is adding a third batching plant in Apopka.",
            "2026-10-01",
            "orlandosentinel.com",
            scope_place="Apopka",
            company_industry="Manufacturing",
        ),
        _signal(
            3,
            JOB_ANALYSING,
            "City of Winter Garden",
            "active_construction_projects",
            "Active Construction Projects",
            "low",
            "The City of Winter Garden approved the second phase of the downtown "
            "streetscape project.",
            "2026-09-28",
            "orlandosentinel.com",
            org_kind="gov",
            revenue_bin="NA",
            entity_type="gov",
        ),
    ],
    JOB_COMPLETED: [
        _signal(
            4,
            JOB_COMPLETED,
            "Peachtree Distribution",
            "operational_capacity_expansion",
            "Operational Capacity Expansion",
            "medium",
            "A $6M build-out adds cold storage and 30 dock doors at the site.",
            "2026-09-30",
            "peachreport.com",
            hq_state="GA",
            hq_county="Fulton",
            scope_place="Atlanta",
            company_industry="Wholesale Trade",
        )
    ],
}

WORKERS: list[dict[str, Any]] = [
    {
        "instance_id": instance,
        "role": role,
        "hostname": instance,
        "version": "v2.1.0",
        "started_at": "2026-10-03T22:10:00+00:00",
        "last_seen": "2026-10-04T11:31:10+00:00",
        "current_tasks": [],
        "proxy_ok": role in {"finder", "sections", "discovery"},
        "proxy_checked_at": "2026-10-04T11:27:00+00:00",
        "gone_at": None,
    }
    for instance, role in (
        ("api-1", "api"),
        ("finder-1", "finder"),
        ("analysis-1", "analysis"),
    )
]

DAILY_STATS: list[dict[str, Any]] = [
    {
        "day": day,
        "jobs": jobs,
        "site_runs": jobs * 4,
        "articles": jobs * 30,
        "companies": jobs * 90,
        "signals": jobs * 20,
        "input_tokens": jobs * 1_000_000,
        "output_tokens": jobs * 200_000,
        "cost_usd": round(jobs * 2.9, 2),
        "known_cost_usd": round(jobs * 2.9, 2),
        "unpriced_calls": 0,
        "unknown_usage_calls": 0,
        "cost_complete": True,
        "failures": {"model_rate_limited": 1} if jobs > 2 else {},
    }
    for day, jobs in (("2026-10-02", 3), ("2026-10-03", 2), ("2026-10-04", 4))
]

FINDER_MEMORY: list[dict[str, Any]] = [
    {
        "location_key": "orlando, fl",
        "industry_key": "construction",
        "domain": domain,
        "verdict": verdict,
        "reason": reason,
        "tier": tier,
        "judged_at": "2026-09-21T10:00:00+00:00",
        "job_id": JOB_COMPLETED,
    }
    for domain, verdict, reason, tier in (
        ("orlandoweekly.com", "keep", "local coverage, medium relevance", 2),
        ("floridadaily.com", "keep", "state coverage, high relevance", 1),
        ("example-spam.com", "reject", "aggregator", None),
    )
]

RANKINGS: dict[str, list[dict[str, Any]]] = {
    JOB_ANALYSING: [
        {
            "search_id": 7,
            "url": f"https://{domain}",
            "name": domain,
            "tier": tier,
            "overall_rank": rank,
            "chosen": rank <= 5,
            "reason": "ranked by coverage and relevance",
            "pages_opened": 3,
            "coverage": "local",
            "relevance": "high",
            "finder_reason": "kept by the finder",
        }
        for rank, (domain, tier) in enumerate(
            (
                ("orlandomagazine.com", 1),
                ("orlandosentinel.com", 1),
                ("westorlandonews.com", 2),
            ),
            start=1,
        )
    ]
}


def fresh_state() -> dict[str, Any]:
    """Deep copies so one test's mutations never leak into another."""
    return {
        "jobs": {job["id"]: deepcopy(job) for job in JOBS},
        "tasks": {task["id"]: deepcopy(task) for task in TASKS},
        "signals": deepcopy(SIGNALS),
        "workers": deepcopy(WORKERS),
        "daily": deepcopy(DAILY_STATS),
        "finder_memory": deepcopy(FINDER_MEMORY),
        "rankings": deepcopy(RANKINGS),
        "api_keys": {},
    }
