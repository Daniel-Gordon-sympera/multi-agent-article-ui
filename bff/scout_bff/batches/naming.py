"""Leg naming of the fan-out: `client_reference = ui:<batch_id>:<slug(industry)>`
(`ui:<batch_id>:0` for url/seeds kinds), contract §4.5."""

from __future__ import annotations

import re
import unicodedata

CLIENT_REFERENCE_PREFIX = "ui"
SINGLE_LEG_SLUG = "0"
MAX_SLUG_LENGTH = 80
_NON_SLUG = re.compile(r"[^a-z0-9]+")


def slug(value: str) -> str:
    """ "Wholesale Trade" → "wholesale-trade"; accents folded, punctuation collapsed."""
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    text = _NON_SLUG.sub("-", folded.lower()).strip("-")
    return text[:MAX_SLUG_LENGTH].strip("-") or "x"


def leg_slug(industry: str | None) -> str:
    return slug(industry) if industry else SINGLE_LEG_SLUG


def client_reference(
    batch_id: str, industry: str | None, suffix: str | None = None
) -> str:
    reference = f"{CLIENT_REFERENCE_PREFIX}:{batch_id}:{leg_slug(industry)}"
    if suffix:
        reference = f"{reference}:{slug(suffix)}"
    return reference


def batch_reference_prefix(batch_id: str) -> str:
    """What `client_reference_prefix` (pipeline PR B3) receives to list a batch's jobs."""
    return f"{CLIENT_REFERENCE_PREFIX}:{batch_id}:"


def parse_client_reference(value: str | None) -> tuple[str, str] | None:
    """`ui:<batch_id>:<slug>[:<suffix>]` → (batch_id, slug); None for other references."""
    if not value:
        return None
    parts = value.split(":")
    if len(parts) < 3 or parts[0] != CLIENT_REFERENCE_PREFIX or not parts[1]:
        return None
    return parts[1], parts[2]
