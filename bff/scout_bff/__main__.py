"""`python -m scout_bff` runs uvicorn on UI_PORT (default 8080)."""

from __future__ import annotations

import uvicorn

from scout_bff.settings import Settings


def main() -> None:
    settings = Settings()
    uvicorn.run(
        "scout_bff.app:app",
        host="0.0.0.0",
        port=settings.ui_port,
        proxy_headers=True,
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
