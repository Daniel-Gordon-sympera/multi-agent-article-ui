"""`python -m scout_bff.openapi` prints the BFF's OpenAPI document to stdout."""

from __future__ import annotations

import json
import sys

from scout_bff.app import create_app
from scout_bff.settings import placeholder_settings


def openapi_document() -> dict:
    """No database or pipeline connection is made; placeholder settings suffice."""
    app = create_app(placeholder_settings(), background_tasks=False)
    return app.openapi()


def main() -> int:
    json.dump(openapi_document(), sys.stdout, indent=2, sort_keys=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
