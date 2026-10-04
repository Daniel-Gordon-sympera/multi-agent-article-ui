"""Pure functions of the cross-job signals read: query, merge/sort/page, CSV, cursors."""

from __future__ import annotations

import pytest

from scout_bff.cursors import decode_offset_cursor, encode_offset_cursor
from scout_bff.errors import Problem
from scout_bff.signals.csv_export import (
    EXPORT_COLUMNS,
    SIGNAL_CSV_COLUMNS,
    csv_cell,
    header_line,
    row_line,
)
from scout_bff.signals.query import DEFAULT_LIMIT, MAX_LIMIT, SignalsQuery
from scout_bff.signals.rows import (
    decorate_row,
    filter_rows,
    job_matches,
    normalise_global_row,
    page_rows,
    sort_rows,
    summarise,
)
from tests.pipeline_fixtures import JOB_ANALYSING, JOB_COMPLETED, JOBS
from tests.pipeline_results_fixtures import SIGNALS

JOB_BY_ID = {job["id"]: job for job in JOBS}


def merged_rows() -> list[dict]:
    rows = []
    for job_id, signals in SIGNALS.items():
        rows.extend(decorate_row(row, JOB_BY_ID[job_id]) for row in signals)
    return sort_rows(rows)


# -- query ------------------------------------------------------------------


def test_query_normalises_and_splits_filters():
    query = SignalsQuery.from_params(
        {
            "signal": "mass_hiring",
            "state": "fl",
            "industry": " Construction ",
            "q": "steel",
            "limit": "25",
            "after": "abc",
        }
    )
    assert query.pass_through == {"signal": "mass_hiring"}
    assert query.job_filters == {"state": "FL"}
    assert query.row_filters == {"industry": "Construction"}
    assert query.free_text == "steel"
    assert query.limit == 25 and query.after == "abc"
    assert (
        query.cache_key
        == SignalsQuery.from_params(
            {
                "q": "steel",
                "industry": "Construction",
                "state": "FL",
                "signal": "mass_hiring",
            }
        ).cache_key
    )
    forwarded = query.forwarded()
    assert "q" not in forwarded and forwarded["limit"] == "25"


def test_query_defaults_and_empty_values():
    query = SignalsQuery.from_params({"state": "  ", "materiality": ""})
    assert query.filters == {}
    assert query.limit == DEFAULT_LIMIT and query.after is None
    assert SignalsQuery.from_params({"limit": str(MAX_LIMIT)}).limit == MAX_LIMIT


@pytest.mark.parametrize(
    ("params", "category"),
    [
        ({"foo": "1"}, "unknown_filter"),
        ({"limit": "0"}, "validation_error"),
        ({"limit": "201"}, "validation_error"),
        ({"limit": "ten"}, "validation_error"),
        ({"date_after": "yesterday"}, "validation_error"),
        ({"job_id": "not-a-uuid"}, "validation_error"),
    ],
)
def test_query_rejects_bad_input(params, category):
    with pytest.raises(Problem) as error:
        SignalsQuery.from_params(params)
    assert error.value.status_code == 422
    assert error.value.category == category


def test_summary_query_ignores_paging_but_rejects_unknown_names():
    query = SignalsQuery.from_params({"limit": "7"}, paging=False)
    assert query.limit == DEFAULT_LIMIT
    with pytest.raises(Problem):
        SignalsQuery.from_params({"page": "2"}, paging=False)


# -- jobs and rows ------------------------------------------------------------


def test_job_matches_state_county_industry_and_id():
    job = JOB_BY_ID[JOB_ANALYSING]
    assert job_matches(job, {"state": "FL", "county": "orange"})
    assert job_matches(job, {"job_industry": "construction", "job_id": JOB_ANALYSING})
    assert not job_matches(job, {"state": "GA"})
    assert not job_matches(job, {"job_industry": "Manufacturing"})
    seeds_job = {"id": "x", "kind": "seeds", "input": {"seeds": []}, "county": "A"}
    assert not job_matches(seeds_job, {"job_industry": "Construction"})


def test_decorate_adds_the_job_columns():
    row = decorate_row(SIGNALS[JOB_ANALYSING][0], JOB_BY_ID[JOB_ANALYSING])
    assert row["job_id"] == JOB_ANALYSING
    assert row["county"] == "Orange" and row["state_code"] == "FL"
    assert row["job_industry"] == "Construction"
    assert row["job_created_at"] == JOB_BY_ID[JOB_ANALYSING]["created_at"]
    assert row["company"] == "Lakeview Builders Group"


def test_sort_is_date_desc_then_id_desc():
    rows = merged_rows()
    dates = [row["date"] for row in rows]
    assert dates == sorted(dates, reverse=True)
    tied = sort_rows(
        [
            {"id": 1, "date": "2026-10-02"},
            {"id": 3, "date": "2026-10-02"},
            {"id": 2, "date": "2026-10-03"},
            {"id": 9, "date": None},
        ]
    )
    assert [row["id"] for row in tied] == [2, 3, 1, 9]


def test_row_filters_and_free_text():
    rows = merged_rows()
    assert len(filter_rows(rows, {"industry": "wholesale trade"}, None)) == 1
    assert len(filter_rows(rows, {"revenue_bin": "NA"}, None)) == 1
    assert len(filter_rows(rows, {"date_after": "2026-10-01"}, None)) == 2
    assert len(filter_rows(rows, {"date_before": "2026-09-28"}, None)) == 1
    assert len(filter_rows(rows, {}, "winter garden")) == 1
    assert len(filter_rows(rows, {}, "cold storage")) == 1
    assert filter_rows(rows, {"industry": "Mining"}, None) == []


def test_page_rows_with_offsets():
    rows = merged_rows()
    page, next_offset = page_rows(rows, 0, 3)
    assert len(page) == 3 and next_offset == 3
    page, next_offset = page_rows(rows, 3, 3)
    assert len(page) == 1 and next_offset is None
    assert page_rows(rows, 99, 3) == ([], None)


def test_offset_cursor_is_bound_to_the_query():
    query = SignalsQuery.from_params({"state": "FL"})
    cursor = encode_offset_cursor(query.cursor_scope, 50)
    assert decode_offset_cursor(cursor, query.cursor_scope) == 50
    other = SignalsQuery.from_params({"state": "GA"})
    with pytest.raises(Problem) as error:
        decode_offset_cursor(cursor, other.cursor_scope)
    assert error.value.category == "invalid_cursor"


def test_summary_counts_companies_jobs_materiality_and_top_signal():
    summary = summarise(merged_rows())
    assert summary["signals"] == 4
    assert summary["companies"] == 4
    assert summary["jobs"] == 2
    assert summary["by_materiality"] == {"high": 2, "medium": 1, "low": 1}
    assert summary["top_signal"] == {
        "key": "operational_capacity_expansion",
        "title": "Operational Capacity Expansion",
        "count": 2,
    }
    assert summarise([])["top_signal"] is None


def test_normalise_global_row_maps_job_state():
    row = normalise_global_row({"id": 1, "job_state": "GA"})
    assert row["state_code"] == "GA"
    assert normalise_global_row({"state_code": "FL"})["state_code"] == "FL"


# -- csv ----------------------------------------------------------------------


def test_csv_columns_are_the_signal_row_plus_job_columns():
    assert EXPORT_COLUMNS[: len(SIGNAL_CSV_COLUMNS)] == SIGNAL_CSV_COLUMNS
    assert EXPORT_COLUMNS[-4:] == ("job_id", "county", "state", "job_industry")
    assert (
        SIGNAL_CSV_COLUMNS[0] == "id" and SIGNAL_CSV_COLUMNS[-1] == "enrichment_source"
    )
    assert header_line().startswith("id,summary_id,")
    assert header_line().rstrip("\r\n").endswith(",job_id,county,state,job_industry")


def test_csv_lines_escape_and_encode_values():
    row = decorate_row(SIGNALS[JOB_COMPLETED][0], JOB_BY_ID[JOB_COMPLETED])
    row["evidence"] = 'He said "yes", then left'
    line = row_line(row)
    assert '"He said ""yes"", then left"' in line
    assert line.endswith(f",{JOB_COMPLETED},Fulton,GA,Wholesale Trade\r\n")
    assert csv_cell(None) == "" and csv_cell(True) == "true"
    assert csv_cell(["a", "b"]) == '["a","b"]'
    assert csv_cell({"verbatim": True}) == '{"verbatim":true}'
