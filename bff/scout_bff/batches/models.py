"""`BatchInput` of `POST /app/batches` (contract §4.3) and the seed shape."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from scout_bff.scouts.models import (
    JobKind,
    JobSettingsInput,
    check_kind_fields,
    check_url,
)
from scout_bff.sources.models import (
    clean_industries,
    validate_county,
    validate_state_code,
)


class SeedInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(default="", max_length=300)
    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url")
    @classmethod
    def url_text(cls, value: str) -> str:
        normalised = check_url(value)
        if normalised is None:
            raise ValueError("A seed URL is required.")
        return normalised


class SaveAsScout(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        text = " ".join(value.split())
        if not text:
            raise ValueError("A Scout name is required.")
        return text


class BatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: JobKind
    county: str = Field(min_length=1, max_length=120)
    state_code: str = Field(min_length=2, max_length=40)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2048)
    seeds: list[SeedInput] | None = Field(default=None, max_length=200)
    industries: list[str] = Field(default_factory=list, max_length=50)
    settings: JobSettingsInput = Field(default_factory=JobSettingsInput)
    scout_id: str | None = Field(default=None, max_length=64)
    save_as_scout: SaveAsScout | None = None
    client_reference_suffix: str | None = Field(default=None, max_length=60)

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
    def kind_fields(self) -> BatchInput:
        check_kind_fields(self.kind, self.url, self.industries)
        if self.scout_id and self.save_as_scout:
            raise ValueError("Pass either scout_id or save_as_scout, not both.")
        return self
