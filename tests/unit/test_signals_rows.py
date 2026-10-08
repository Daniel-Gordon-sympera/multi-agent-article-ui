"""Cross-job query validation and batch translation."""

import pytest

from scout_bff.errors import Problem
from scout_bff.signals.query import DEFAULT_LIMIT, MAX_LIMIT, SignalsQuery


def test_query_normalises_and_forwards_filters():
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
    assert query.forwarded() == {
        "signal": "mass_hiring",
        "state": "FL",
        "industry": "Construction",
        "q": "steel",
        "limit": "25",
        "after": "abc",
    }


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
