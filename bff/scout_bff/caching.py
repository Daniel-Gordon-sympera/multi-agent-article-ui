"""A small in-process TTL cache for BFF aggregates (scout last runs, suggestions, …)."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Generic, TypeVar

T = TypeVar("T")


class TtlCache(Generic[T]):
    """`get_or_load(key, loader)` returns the cached value while it is fresh."""

    def __init__(self, ttl_seconds: float, *, max_entries: int = 512) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._entries: dict[Hashable, tuple[float, T]] = {}

    def get(self, key: Hashable) -> T | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at <= time.monotonic():
            self._entries.pop(key, None)
            return None
        return value

    def set(self, key: Hashable, value: T) -> T:
        if len(self._entries) >= self.max_entries:
            now = time.monotonic()
            for stale in [k for k, (exp, _) in self._entries.items() if exp <= now]:
                self._entries.pop(stale, None)
            if len(self._entries) >= self.max_entries:
                self._entries.pop(next(iter(self._entries)))
        self._entries[key] = (time.monotonic() + self.ttl_seconds, value)
        return value

    async def get_or_load(self, key: Hashable, loader: Callable[[], Awaitable[T]]) -> T:
        cached = self.get(key)
        if cached is not None:
            return cached
        return self.set(key, await loader())

    def invalidate(self, key: Hashable | None = None) -> None:
        if key is None:
            self._entries.clear()
        else:
            self._entries.pop(key, None)
