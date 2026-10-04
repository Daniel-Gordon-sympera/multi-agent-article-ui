"""CSV import parsing (`POST /app/sources/import`): columns, limits, skipped rows."""

import pytest

from scout_bff.errors import Problem
from scout_bff.sources.csv_import import (
    MAX_ROWS,
    MAX_UPLOAD_BYTES,
    parse_sources_csv,
)

HEADER = "name,url,county,state,industries\n"


def test_parses_rows_normalising_state_url_and_industries():
    content = (
        HEADER
        + "Orlando Magazine,https://www.orlandomagazine.com,Orange County,Florida,"
        "Construction; Manufacturing;;Construction\n"
        + '"Range Wire, Inc.",rangewire.com,Jefferson,co,\n'
    ).encode()
    parsed = parse_sources_csv(content)
    assert parsed.skipped == []
    first, second = parsed.rows
    assert (first.row, first.name, first.domain) == (
        2,
        "Orlando Magazine",
        "orlandomagazine.com",
    )
    assert first.url == "https://www.orlandomagazine.com/"
    assert (first.county, first.state_code) == ("Orange", "FL")
    assert first.industries == ["Construction", "Manufacturing"]
    assert (second.name, second.state_code, second.industries) == (
        "Range Wire, Inc.",
        "CO",
        [],
    )
    assert second.url == "https://rangewire.com/"


def test_header_order_is_free_and_industries_optional():
    content = ("state,county,url,name\nFL,Orange,https://a.com,A\n").encode()
    parsed = parse_sources_csv(content)
    assert [row.domain for row in parsed.rows] == ["a.com"]


def test_bad_rows_are_skipped_with_reasons_and_line_numbers():
    content = (
        HEADER
        + ",https://a.com,Orange,FL,\n"
        + "B,ftp://b.com,Orange,FL,\n"
        + "C,https://c.com,,FL,\n"
        + "D,https://d.com,Orange,Narnia,\n"
        + "\n"
        + "E,https://e.com,Orange,FL,Construction\n"
        + "E again,https://www.e.com/other,orange county,Florida,\n"
    ).encode()
    parsed = parse_sources_csv(content)
    assert [row.name for row in parsed.rows] == ["E"]
    assert parsed.skipped == [
        {"row": 2, "reason": "missing name"},
        {
            "row": 3,
            "reason": "invalid url: The URL must start with http:// or https://.",
        },
        {"row": 4, "reason": "missing county"},
        {"row": 5, "reason": "unknown state 'Narnia'"},
        {"row": 8, "reason": "duplicate of an earlier row in the file"},
    ]


def test_missing_required_columns_and_empty_files_are_rejected():
    with pytest.raises(Problem) as missing:
        parse_sources_csv(b"name,url\nA,https://a.com\n")
    assert missing.value.category == "invalid_csv"
    assert "county, state" in str(missing.value.detail)
    with pytest.raises(Problem) as empty:
        parse_sources_csv(b"")
    assert empty.value.category == "invalid_csv"


def test_size_and_row_limits():
    with pytest.raises(Problem) as too_large:
        parse_sources_csv(b"x" * (MAX_UPLOAD_BYTES + 1))
    assert too_large.value.status_code == 413
    rows = "".join(f"S{i},https://s{i}.com,Orange,FL,\n" for i in range(MAX_ROWS + 1))
    with pytest.raises(Problem) as too_many:
        parse_sources_csv((HEADER + rows).encode())
    assert too_many.value.category == "too_many_rows"
    exactly = "".join(f"S{i},https://s{i}.com,Orange,FL,\n" for i in range(MAX_ROWS))
    assert len(parse_sources_csv((HEADER + exactly).encode()).rows) == MAX_ROWS


def test_utf8_bom_and_windows_encodings_are_accepted():
    content = ("﻿" + HEADER + "Café News,https://cafe.com,Orange,FL,\n").encode("utf-8")
    assert parse_sources_csv(content).rows[0].name == "Café News"
    latin = (HEADER + "Café News,https://cafe.com,Orange,FL,\n").encode("cp1252")
    assert parse_sources_csv(latin).rows[0].name == "Café News"
