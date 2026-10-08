"""Suggestion building and the merge/dedupe rules of `GET /app/sources/suggestions`."""

from scout_bff.sources.precision import median_ratio, parse_precision
from scout_bff.sources.suggestions import (
    industry_label,
    location_keys,
    merge_suggestions,
    ordinal,
    suggestion_from_memory,
    suggestion_from_ranking,
)

JOB = {
    "id": "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41",
    "county": "Orange",
    "state_code": "FL",
    "created_at": "2026-10-04T11:02:00+00:00",
    "input": {"location": "Orlando, FL", "industry": "Construction"},
}


def test_location_keys_cover_both_spellings():
    assert location_keys("Orange County", "FL") == [
        "Orange County, Florida",
        "Orange, FL",
    ]


def test_ordinals_and_industry_labels():
    assert [ordinal(n) for n in (1, 2, 3, 4, 11, 12, 13, 21, 102)] == [
        "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "102nd",
    ]  # fmt: skip
    assert industry_label("wholesale trade") == "Wholesale Trade"
    assert industry_label("finance and insurance") == "Finance and Insurance"
    assert industry_label(None) is None


def test_ranking_row_becomes_a_suggestion_with_rank_and_reason():
    row = {
        "url": "https://www.westorlandonews.com",
        "name": "West Orlando News",
        "tier": 2,
        "overall_rank": 6,
        "chosen": False,
        "coverage": "local",
        "relevance": "high",
        "finder_reason": "Kept by the finder",
    }
    item = suggestion_from_ranking(row, JOB)
    assert item == {
        "domain": "westorlandonews.com",
        "name": "West Orlando News",
        "url": "https://www.westorlandonews.com",
        "tier": "2",
        "verdict": "keep",
        "reason": "Kept by the finder (coverage: local, relevance: high); ranked 6th",
        "judged_at": JOB["created_at"],
        "rank": 6,
        "job_id": JOB["id"],
        "county": "Orange",
        "state_code": "FL",
        "industry": "Construction",
        "origin": "ranking",
    }
    chosen = suggestion_from_ranking({**row, "chosen": True, "overall_rank": 1}, JOB)
    assert chosen["reason"].endswith("ranked 1st, explored in this job")
    assert suggestion_from_ranking({"url": "not a url", "name": ""}, JOB) is None


def test_memory_row_becomes_a_suggestion():
    row = {
        "location_key": "orlando, fl",
        "industry_key": "construction",
        "domain": "denverite.com",
        "verdict": "keep",
        "reason": "local coverage",
        "tier": None,
        "judged_at": "2026-09-21T10:00:00+00:00",
        "job_id": None,
    }
    item = suggestion_from_memory(row, "Jefferson County", "CO")
    assert item["domain"] == "denverite.com"
    assert item["url"] == "https://denverite.com"
    assert item["tier"] is None
    assert (item["county"], item["state_code"]) == ("Jefferson", "CO")
    assert item["industry"] == "Construction"
    assert item["origin"] == "finder_memory"


def test_merge_dedupes_by_domain_and_drops_listed_dismissed_and_other_industries():
    def item(domain, industry="Construction", county="Orange", state="FL", **extra):
        return {
            "domain": domain,
            "county": county,
            "state_code": state,
            "industry": industry,
            **extra,
        }

    candidates = [
        item("a.com", origin="ranking"),
        item("a.com", origin="finder_memory"),
        item("listed.com"),
        item("dismissed.com"),
        item("b.com", industry="Manufacturing"),
        item("c.com"),
        item("a.com", county="Jefferson", state="CO"),
        item("d.com"),
    ]
    merged = merge_suggestions(
        candidates,
        listed={("listed.com", "orange", "FL")},
        dismissed={("dismissed.com", "orange", "FL")},
        industry=None,
        limit=4,
    )
    assert [(m["domain"], m["county"]) for m in merged] == [
        ("a.com", "Orange"),
        ("b.com", "Orange"),
        ("c.com", "Orange"),
        ("a.com", "Jefferson"),
    ]
    assert merged[0]["origin"] == "ranking"
    by_industry = merge_suggestions(
        candidates, listed=set(), dismissed=set(), industry="manufacturing", limit=10
    )
    assert [m["domain"] for m in by_industry] == ["b.com"]


def test_acceptance_rate_preserves_complete_and_incomplete_coverage():
    page = {
        "items": [
            {"domain": "other.com", "accepted": 1, "candidates": 2},
            {
                "domain": "a.com",
                "accepted_articles": 18,
                "candidates": 142,
                "ratio": 18 / 142,
                "complete": True,
                "basis": "site_run_candidates_v1",
                "last_job_id": "j",
            },
        ],
        "next_cursor": None,
    }
    parsed = parse_precision(page, "a.com")
    assert parsed["accepted"] == 18 and parsed["candidates"] == 142
    assert parsed["job_id"] == "j"
    assert round(parsed["ratio"], 4) == round(18 / 142, 4)
    single = parse_precision(
        {
            "items": [
                {
                    "domain": "a.com",
                    "accepted_articles": 4,
                    "candidates": None,
                    "ratio": None,
                    "complete": False,
                    "last_job_at": "2026-10-04",
                }
            ]
        },
        "a.com",
    )
    assert single["ratio"] is None and single["candidates"] is None
    assert single["accepted"] == 4 and single["complete"] is False
    assert parse_precision({"items": []}, "a.com") is None
    assert parse_precision("nope", "a.com") is None
    assert (
        median_ratio([parsed, single, None, {"ratio": 0.3}])
        == (parsed["ratio"] + 0.3) / 2
    )


def test_subdomain_source_uses_backend_registered_domain_statistics():
    result = parse_precision(
        {
            "items": [
                {
                    "domain": "example.com",
                    "accepted_articles": 3,
                    "candidates": 6,
                    "ratio": 0.5,
                    "complete": True,
                    "basis": "site_run_candidates_v1",
                }
            ],
            "next_cursor": None,
        },
        "news.example.com",
    )
    assert result["accepted"] == 3 and result["ratio"] == 0.5
