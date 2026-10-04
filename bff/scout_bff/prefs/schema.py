"""The `Prefs` shape of contract §4.3 and its validation (enum values only)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

Theme = Literal["system", "light", "dark"]
Density = Literal["comfortable", "compact"]
TimeDisplay = Literal["utc", "local"]
Landing = Literal["/", "/jobs", "/signals"]

ALLOWED_VALUES: dict[str, tuple[str, ...]] = {
    "theme": ("system", "light", "dark"),
    "density": ("comfortable", "compact"),
    "time_display": ("utc", "local"),
    "landing": ("/", "/jobs", "/signals"),
}
DEFAULT_PREFS: dict[str, str] = {
    "theme": "system",
    "density": "comfortable",
    "time_display": "utc",
    "landing": "/",
}


class PrefsPatch(BaseModel):
    """Body of PUT /app/prefs: every field optional, unknown fields rejected."""

    model_config = ConfigDict(extra="forbid")
    theme: Theme | None = None
    density: Density | None = None
    time_display: TimeDisplay | None = None
    landing: Landing | None = None

    def as_patch(self) -> dict[str, str]:
        return {
            key: value for key, value in self.model_dump().items() if value is not None
        }


def sanitise_prefs(stored: Any) -> dict[str, str]:
    """Keep only known keys with allowed values (the jsonb column is free-form)."""
    if not isinstance(stored, dict):
        return {}
    return {
        key: value
        for key, value in stored.items()
        if key in ALLOWED_VALUES and value in ALLOWED_VALUES[key]
    }
