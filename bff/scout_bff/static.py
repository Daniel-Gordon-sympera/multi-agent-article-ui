"""Serve the built SPA: immutable /assets, index.html fallback for app routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from scout_bff.errors import Problem

STATIC_DIRECTORY = Path(__file__).parent / "static"
API_PREFIXES = (
    "/app",
    "/v1",
    "/healthz",
    "/readyz",
    "/docs",
    "/redoc",
    "/openapi.json",
)
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"


def is_api_path(path: str) -> bool:
    return any(
        path == prefix or path.startswith(prefix + "/") for prefix in API_PREFIXES
    )


class ImmutableStaticFiles(StaticFiles):
    """Hashed Vite assets never change, so they may be cached for a year."""

    async def get_response(self, path: str, scope: Scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = IMMUTABLE_CACHE
        return response


def mount_spa(app: FastAPI, directory: Path | None = None) -> bool:
    """Mount the SPA when its folder exists; returns whether it did."""
    root = (directory or STATIC_DIRECTORY).resolve()
    index = root / "index.html"
    if not index.is_file():
        return False
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(request: Request, full_path: str):
        if is_api_path(request.url.path):
            raise Problem(404, "not_found", "The requested resource does not exist.")
        candidate = (root / full_path).resolve() if full_path else index
        if (
            candidate != index
            and candidate.is_file()
            and candidate.is_relative_to(root)
        ):
            return FileResponse(candidate, headers={"Cache-Control": NO_CACHE})
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})

    return True
