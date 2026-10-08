"""Cache authoritative cost estimates from the pipeline's complete-cost records."""

from __future__ import annotations

import time
from typing import Any

from scout_bff.pipeline_client import KeyRole, PipelineClient

CACHE_SECONDS = 60.0


class EstimateCache:
    def __init__(self, ttl_seconds: float = CACHE_SECONDS) -> None:
        self.ttl = ttl_seconds
        self._entries: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}

    def get(self, key: tuple[Any, ...]) -> dict[str, Any] | None:
        entry = self._entries.get(key)
        if entry and entry[0] > time.monotonic():
            return entry[1]
        self._entries.pop(key, None)
        return None

    def put(self, key: tuple[Any, ...], value: dict[str, Any]) -> None:
        self._entries[key] = (time.monotonic() + self.ttl, value)


async def estimate_from_api(
    pipeline: PipelineClient,
    role: KeyRole,
    kind: str,
    sites: int | None,
    industry: str | None,
    days: int | None = None,
) -> dict[str, Any]:
    return await pipeline.get_json(
        "/v1/stats/cost-estimate",
        role=role,
        kind=kind,
        sites=sites,
        industry=industry,
        days=days,
    )
