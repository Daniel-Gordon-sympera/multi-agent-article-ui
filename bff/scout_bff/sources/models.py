"""Request bodies of the `/app/sources*` endpoints (contract §4.3)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from scout_bff.sources.states import normalise_county, normalise_state_code

Origin = Literal["manual", "finder", "csv"]
Status = Literal["active", "removed"]


def clean_industries(values: list[str] | None) -> list[str]:
    """Trim, drop blanks and duplicates while keeping the order."""
    seen: list[str] = []
    for value in values or []:
        text = " ".join(str(value).split())
        if text and text.casefold() not in {s.casefold() for s in seen}:
            seen.append(text)
    return seen


def validate_state_code(value: str) -> str:
    code = normalise_state_code(value)
    if code is None:
        raise ValueError("Enter a US state as a 2-letter code or its full name.")
    return code


def validate_county(value: str) -> str:
    county = normalise_county(value)
    if not county:
        raise ValueError("A county is required.")
    return county


class SourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=253)
    url: str = Field(min_length=1, max_length=2048)
    county: str = Field(min_length=1, max_length=120)
    state_code: str = Field(min_length=2, max_length=40)
    industries: list[str] = Field(default_factory=list, max_length=50)

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

    @field_validator("industries")
    @classmethod
    def industries_list(cls, value: list[str]) -> list[str]:
        return clean_industries(value)


class SourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=253)
    url: str | None = Field(default=None, min_length=1, max_length=2048)
    county: str | None = Field(default=None, min_length=1, max_length=120)
    state_code: str | None = Field(default=None, min_length=2, max_length=40)
    industries: list[str] | None = Field(default=None, max_length=50)

    @field_validator("state_code")
    @classmethod
    def state(cls, value: str | None) -> str | None:
        return None if value is None else validate_state_code(value)

    @field_validator("county")
    @classmethod
    def county_text(cls, value: str | None) -> str | None:
        return None if value is None else validate_county(value)

    @field_validator("industries")
    @classmethod
    def industries_list(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else clean_industries(value)


class SuggestionBody(BaseModel):
    """A `Suggestion` as the SPA received it from `GET /app/sources/suggestions`."""

    model_config = ConfigDict(extra="ignore")
    domain: str = Field(min_length=1, max_length=253)
    name: str | None = Field(default=None, max_length=200)
    url: str = Field(min_length=1, max_length=2048)
    tier: str | int | None = None
    verdict: str = Field(default="keep", max_length=40)
    reason: str = Field(default="", max_length=2000)
    judged_at: str | None = None
    rank: int | None = None
    job_id: str | None = None
    county: str = Field(min_length=1, max_length=120)
    state_code: str = Field(min_length=2, max_length=40)
    industry: str | None = Field(default=None, max_length=200)
    origin: Literal["finder_memory", "ranking"] = "finder_memory"

    @field_validator("state_code")
    @classmethod
    def state(cls, value: str) -> str:
        return validate_state_code(value)

    @field_validator("county")
    @classmethod
    def county_text(cls, value: str) -> str:
        return validate_county(value)


class PromoteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suggestion: SuggestionBody
    name: str | None = Field(default=None, max_length=200)
    industries: list[str] | None = Field(default=None, max_length=50)

    @field_validator("industries")
    @classmethod
    def industries_list(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else clean_industries(value)


class DismissInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(min_length=1, max_length=253)
    county: str = Field(min_length=1, max_length=120)
    state_code: str = Field(min_length=2, max_length=40)

    @field_validator("state_code")
    @classmethod
    def state(cls, value: str) -> str:
        return validate_state_code(value)

    @field_validator("county")
    @classmethod
    def county_text(cls, value: str) -> str:
        return validate_county(value)
