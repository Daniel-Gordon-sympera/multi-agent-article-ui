"""Parse the `name,url,county,state,industries` CSV of `POST /app/sources/import`."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field

from scout_bff.errors import Problem
from scout_bff.sources.domains import InvalidUrl, domain_of, normalise_url
from scout_bff.sources.models import clean_industries
from scout_bff.sources.states import normalise_county, normalise_state_code

MAX_UPLOAD_BYTES = 1_048_576
MAX_ROWS = 2_000
REQUIRED_COLUMNS = ("name", "url", "county", "state")
OPTIONAL_COLUMNS = ("industries",)
CSV_TEMPLATE = (
    "name,url,county,state,industries\n"
    "Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction;Manufacturing\n"
)


@dataclass
class ParsedSource:
    row: int
    name: str
    url: str
    domain: str
    county: str
    state_code: str
    industries: list[str]

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.domain, self.county.casefold(), self.state_code)


@dataclass
class ParsedImport:
    rows: list[ParsedSource] = field(default_factory=list)
    skipped: list[dict[str, object]] = field(default_factory=list)

    def skip(self, row: int, reason: str) -> None:
        self.skipped.append({"row": row, "reason": reason})


def decode_upload(content: bytes) -> str:
    if len(content) > MAX_UPLOAD_BYTES:
        raise Problem(413, "file_too_large", "The CSV must be 1 MB or smaller.")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise Problem(422, "invalid_csv", "The file is not UTF-8 text.")


def _header_index(header: list[str]) -> dict[str, int]:
    names = [" ".join(cell.strip().lower().split()) for cell in header]
    index = {name: position for position, name in enumerate(names) if name}
    missing = [column for column in REQUIRED_COLUMNS if column not in index]
    if missing:
        raise Problem(
            422,
            "invalid_csv",
            "The header must contain the columns name, url, county, state "
            f"(and optionally industries); missing: {', '.join(missing)}.",
        )
    return index


def parse_sources_csv(content: bytes) -> ParsedImport:
    """Rows with a problem land in `skipped` (1-based file line numbers); the rest in
    `rows`. Duplicates inside the file are skipped too."""
    text = decode_upload(content)
    reader = csv.reader(io.StringIO(text, newline=""))
    parsed = ParsedImport()
    try:
        header = next(reader)
    except StopIteration:
        raise Problem(422, "invalid_csv", "The CSV is empty.") from None
    except csv.Error as error:
        raise Problem(
            422, "invalid_csv", f"The CSV could not be read: {error}."
        ) from None
    index = _header_index(header)
    seen: set[tuple[str, str, str]] = set()
    data_rows = 0
    for line_number, cells in enumerate(reader, start=2):
        if not any(cell.strip() for cell in cells):
            continue
        data_rows += 1
        if data_rows > MAX_ROWS:
            raise Problem(
                422, "too_many_rows", f"The CSV may contain at most {MAX_ROWS} rows."
            )

        def cell(column: str) -> str:
            position = index.get(column)
            if position is None or position >= len(cells):
                return ""
            return cells[position].strip()

        name = " ".join(cell("name").split())
        if not name:
            parsed.skip(line_number, "missing name")
            continue
        try:
            url = normalise_url(cell("url"))
            domain = domain_of(url)
        except InvalidUrl as error:
            parsed.skip(line_number, f"invalid url: {error}")
            continue
        county = normalise_county(cell("county"))
        if not county:
            parsed.skip(line_number, "missing county")
            continue
        state_code = normalise_state_code(cell("state"))
        if state_code is None:
            parsed.skip(line_number, f"unknown state '{cell('state')}'")
            continue
        industries = clean_industries(
            [part for part in cell("industries").split(";") if part.strip()]
        )
        row = ParsedSource(
            row=line_number,
            name=name,
            url=url,
            domain=domain,
            county=county,
            state_code=state_code,
            industries=industries,
        )
        if row.key in seen:
            parsed.skip(line_number, "duplicate of an earlier row in the file")
            continue
        seen.add(row.key)
        parsed.rows.append(row)
    return parsed
