"""The SPA's BFF contract is generated from the release it runs alongside."""

import json
from pathlib import Path

from scout_bff.openapi import openapi_document


def test_published_bff_openapi_matches_runtime():
    root = Path(__file__).resolve().parents[2]
    published = json.loads((root / "docs/api/openapi-bff.json").read_text())
    assert published == openapi_document()
