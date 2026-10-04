"""A small per-process TTL cache with single-flight computation per key.

The overview, attention and system aggregates are read by every open tab every few
seconds; caching them for 5–10 s keeps the pipeline API load flat regardless of the
number of viewers (plan §14). Values are shared across users: every cached read is a
GET that both pipeline keys may perform.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from fastapi import Request

T = TypeVar("T")

OVERVIEW_TTL_SECONDS = 10.0
ACTIVE_RUNS_TTL_SECONDS = 5.0
ATTENTION_TTL_SECONDS = 10.0
SYSTEM_TTL_SECONDS = 10.0


class TtlCache:
    """`get_or_compute(key, ttl, compute)`; failures are never cached."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._entries: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _lock_for(self, key: str) -> asyncio.Lock:
        lock = self._locks.get(key)
        if lock is None:
            lock = self._locks[key] = asyncio.Lock()
        return lock

    def peek(self, key: str) -> Any | None:
        entry = self._entries.get(key)
        if entry is None or entry[0] <= self._clock():
            return None
        return entry[1]

    async def get_or_compute(
        self, key: str, ttl: float, compute: Callable[[], Awaitable[T]]
    ) -> T:
        cached = self.peek(key)
        if cached is not None:
            return cached
        async with self._lock_for(key):
            cached = self.peek(key)
            if cached is not None:
                return cached
            value = await compute()
            self._entries[key] = (self._clock() + ttl, value)
            return value

    def invalidate(self, key: str | None = None) -> None:
        if key is None:
            self._entries.clear()
        else:
            self._entries.pop(key, None)


def request_cache(request: Request) -> TtlCache:
    """One TtlCache per application, created lazily on `app.state`."""
    cache = getattr(request.app.state, "b4_ttl_cache", None)
    if cache is None:
        cache = TtlCache()
        request.app.state.b4_ttl_cache = cache
    return cache
