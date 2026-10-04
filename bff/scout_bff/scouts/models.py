"""Request bodies of `/app/scouts*` (contract §4.3) and the shared settings shape."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from scout_bff.sources.domains import InvalidUrl, normalise_url
from scout_bff.sources.models import (
    clean_industries,
    validate_county,
    validate_state_code,
)

JobKind = Literal["location_industry", "seeds", "url"]
SourceMode = Literal["finder", "seeds"]
MemoryMode = Literal["full", "pages_only", "off"]


class JobSettingsInput(BaseModel):
    """Overrides only; the pipeline API applies its own defaults (contract §4.5)."""

    model_config = ConfigDict(extra="allow")
    days: int | None = Field(default=None, ge=1, le=3650)
    sites: int | None = Field(default=None, ge=1, le=100)
    site_timeout: int | None = Field(default=None, ge=0)
    max_runtime: int | None = Field(default=None, ge=0)
    memory_mode: MemoryMode | None = None
    reanalyze: bool | None = None
    reenrich: bool | None = None

    def overrides(self) -> dict[str, Any]:
        return {
            key: value for key, value in self.model_dump().items() if value is not None
        }


def check_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    try:
        return normalise_url(value)
    except InvalidUrl as error:
        raise ValueError(str(error)) from None


def check_kind_fields(kind: str, url: str | None, industries: list[str]) -> None:
    if kind == "url" and not url:
        raise ValueError("A site URL is required for kind 'url'.")
    if kind == "location_industry" and not industries:
        raise ValueError("Pick at least one industry for kind 'location_industry'.")


class ScoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    kind: JobKind
    county: str = Field(min_length=1, max_length=120)
    state_code: str = Field(min_length=2, max_length=40)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2048)
    industries: list[str] = Field(default_factory=list, max_length=50)
    source_mode: SourceMode = "finder"
    settings: JobSettingsInput = Field(default_factory=JobSettingsInput)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        text = " ".join(value.split())
        if not text:
            raise ValueError("A name is required.")
        return text

    @field_validator("state_code")
    @classmethod
    def state(cls, value: str) -> str:
        return validate_state_code(value)

    @field_validator("county")
    @classmethod
    def county_text(cls, value: str) -> str:
        return validate_county(value)

    @field_validator("location")
    @classmethod
    def location_text(cls, value: str | None) -> str | None:
        text = " ".join((value or "").split())
        return text or None

    @field_validator("url")
    @classmethod
    def url_text(cls, value: str | None) -> str | None:
        return check_url(value)

    @field_validator("industries")
    @classmethod
    def industries_list(cls, value: list[str]) -> list[str]:
        return clean_industries(value)

    @model_validator(mode="after")
    def kind_fields(self) -> ScoutInput:
        check_kind_fields(self.kind, self.url, self.industries)
        return self


class ScoutUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    kind: JobKind | None = None
    county: str | None = Field(default=None, min_length=1, max_length=120)
    state_code: str | None = Field(default=None, min_length=2, max_length=40)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2048)
    industries: list[str] | None = Field(default=None, max_length=50)
    source_mode: SourceMode | None = None
    settings: JobSettingsInput | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = " ".join(value.split())
        if not text:
            raise ValueError("A name is required.")
        return text

    @field_validator("state_code")
    @classmethod
    def state(cls, value: str | None) -> str | None:
        return None if value is None else validate_state_code(value)

    @field_validator("county")
    @classmethod
    def county_text(cls, value: str | None) -> str | None:
        return None if value is None else validate_county(value)

    @field_validator("url")
    @classmethod
    def url_text(cls, value: str | None) -> str | None:
        return check_url(value)

    @field_validator("industries")
    @classmethod
    def industries_list(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else clean_industries(value)


class RunScoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_reference_suffix: str | None = Field(default=None, max_length=60)
