"""US state normalisation: full names or 2-letter codes → the 2-letter code."""

from __future__ import annotations

STATE_NAMES: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "PR": "Puerto Rico",
    "GU": "Guam",
    "VI": "U.S. Virgin Islands",
    "AS": "American Samoa",
    "MP": "Northern Mariana Islands",
}

_CODES_BY_NAME = {name.casefold(): code for code, name in STATE_NAMES.items()}


def normalise_state_code(value: str | None) -> str | None:
    """ "Florida" / "florida" / "fl" / "FL" → "FL"; unknown values → None."""
    if value is None:
        return None
    text = " ".join(value.strip().split())
    if not text:
        return None
    upper = text.upper()
    if upper in STATE_NAMES:
        return upper
    return _CODES_BY_NAME.get(text.casefold())


def state_name(code: str) -> str:
    """ "FL" → "Florida"; unknown codes come back unchanged."""
    return STATE_NAMES.get(code.upper(), code)


def normalise_county(value: str) -> str:
    """Trim and drop a trailing "County" so "Orange County" and "Orange" compare equal."""
    text = " ".join(value.strip().split())
    lowered = text.casefold()
    if lowered.endswith(" county"):
        text = text[: -len(" county")].rstrip()
    return text
