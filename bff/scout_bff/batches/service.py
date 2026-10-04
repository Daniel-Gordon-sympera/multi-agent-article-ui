"""The fan-out of contract §4.5: one batch → one `POST /v1/jobs` per industry (or one leg
for url/seeds), legs recorded in ui.batch_jobs, 409-with-job counted as success."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from scout_bff.auth.deps import AuthenticatedUser
from scout_bff.batches import repository as batches
from scout_bff.batches.models import BatchInput
from scout_bff.batches.naming import client_reference
from scout_bff.errors import Problem
from scout_bff.logging import get_logger
from scout_bff.pipeline_client import (
    PipelineClient,
    PipelineError,
    PipelineTimeout,
    PipelineUnavailable,
)
from scout_bff.scouts import repository as scouts
from scout_bff.sources import repository as sources
from scout_bff.sources.states import state_name

logger = get_logger("scout_bff.batches")


@dataclass
class Leg:
    position: int
    industry: str | None
    client_reference: str
    body: dict[str, Any]
    job_id: str | None = None
    status: str | None = None
    error: dict[str, Any] | None = None
    attempted: bool = False


@dataclass
class FanOutResult:
    batch_id: UUID
    scout: dict[str, Any] | None
    run_number: int | None
    created_at: Any
    legs: list[Leg] = field(default_factory=list)


def default_location(county: str, state_code: str) -> str:
    return f"{county} County, {state_name(state_code)}"


def api_job_body(
    body: BatchInput,
    industry: str | None,
    seeds: list[dict[str, str]] | None,
    reference: str,
) -> dict[str, Any]:
    """The `POST /v1/jobs` body of one leg (settings = overrides only)."""
    job: dict[str, Any] = {
        "kind": body.kind,
        "county": body.county,
        "state": body.state_code,
        "client_reference": reference,
    }
    overrides = body.settings.overrides()
    if overrides:
        job["settings"] = overrides
    if body.kind == "location_industry":
        job["location"] = body.location or default_location(
            body.county, body.state_code
        )
        job["industry"] = industry
    elif body.kind == "url":
        job["url"] = body.url
    else:
        job["seeds"] = seeds or []
    return job


def plan_legs(
    body: BatchInput, batch_id: UUID, seeds: list[dict[str, str]] | None
) -> list[Leg]:
    industries: list[str | None] = (
        list(body.industries) if body.kind == "location_industry" else [None]
    )
    legs = []
    for position, industry in enumerate(industries, start=1):
        reference = client_reference(
            str(batch_id), industry, body.client_reference_suffix
        )
        legs.append(
            Leg(
                position=position,
                industry=industry,
                client_reference=reference,
                body=api_job_body(body, industry, seeds, reference),
            )
        )
    return legs


async def compose_seeds(
    connection: AsyncConnection, body: BatchInput
) -> list[dict[str, str]]:
    """Explicit seeds win; otherwise the active sources of the county/state (+ industries)."""
    if body.seeds:
        return [{"title": seed.title, "url": seed.url} for seed in body.seeds]
    rows = await sources.active_seed_sources(
        connection,
        county=body.county,
        state_code=body.state_code,
        industries=body.industries,
    )
    return [{"title": row["name"], "url": row["url"]} for row in rows]


async def submit_legs(pipeline: PipelineClient, legs: list[Leg]) -> None:
    """Sequential submission; once the API is unreachable the remaining legs are not tried."""
    unavailable: PipelineError | None = None
    for leg in legs:
        if unavailable is not None:
            leg.error = problem_dict(unavailable, attempted=False)
            continue
        try:
            created = await pipeline.create_job(leg.body)
        except (PipelineUnavailable, PipelineTimeout) as error:
            unavailable = error
            leg.error = problem_dict(error, attempted=False)
            continue
        except PipelineError as error:
            leg.attempted = True
            if error.status == 409 and error.extra.get("job_id"):
                leg.job_id = str(error.extra["job_id"])
                leg.status = error.extra.get("job_status")
            else:
                leg.error = problem_dict(error, attempted=True)
            continue
        leg.attempted = True
        leg.job_id = str(created.get("job_id") or "") or None
        leg.status = created.get("status") or "queued"
        if leg.job_id is None:
            leg.error = {
                "status": 502,
                "category": "upstream_error",
                "detail": "The pipeline API answered without a job id.",
                "attempted": True,
            }


def problem_dict(error: PipelineError, *, attempted: bool) -> dict[str, Any]:
    return {
        "status": error.status,
        "category": error.category,
        "detail": error.detail,
        "attempted": attempted,
    }


async def resolve_scout(
    connection: AsyncConnection, body: BatchInput, user: AuthenticatedUser
) -> dict[str, Any] | None:
    if body.scout_id:
        try:
            scout_id = UUID(body.scout_id)
        except ValueError:
            raise Problem(404, "scout_not_found", "The Scout does not exist.") from None
        scout = await scouts.lock_scout(connection, scout_id)
        if scout["archived_at"] is not None:
            raise Problem(409, "scout_archived", "This Scout is archived.")
        return scout
    if body.save_as_scout:
        try:
            return await scouts.create_scout(
                connection,
                name=body.save_as_scout.name,
                kind=body.kind,
                county=body.county,
                state_code=body.state_code,
                location=body.location,
                url=body.url,
                industries=body.industries,
                source_mode="seeds" if body.kind == "seeds" else "finder",
                settings=body.settings.overrides(),
                created_by=user.id,
            )
        except scouts.ScoutExists:
            raise Problem(
                409, "scout_exists", "A Scout with this name already exists."
            ) from None
    return None


async def run_fan_out(
    engine: AsyncEngine,
    pipeline: PipelineClient,
    user: AuthenticatedUser,
    body: BatchInput,
) -> dict[str, Any]:
    """Create the batch, submit the legs, record them; everything rolls back when no leg
    could be attempted (`502 pipeline_api_unavailable`)."""
    batch_id = uuid.uuid4()
    async with engine.begin() as connection:
        scout = await resolve_scout(connection, body, user)
        run_number = None
        if scout is not None:
            run_number = await batches.count_batches(connection, scout["id"]) + 1
        seeds = await compose_seeds(connection, body) if body.kind == "seeds" else None
        if body.kind == "seeds" and not seeds:
            raise Problem(
                422,
                "no_active_sources",
                f"No active sources match {body.county} County, {body.state_code}"
                + (" for these industries." if body.industries else "."),
            )
        legs = plan_legs(body, batch_id, seeds)
        await batches.insert_batch(
            connection,
            batch_id=batch_id,
            scout_id=scout["id"] if scout else None,
            run_number=run_number,
            requested=body.model_dump(exclude_none=True),
            created_by=user.id,
        )
        await submit_legs(pipeline, legs)
        if not any(leg.attempted for leg in legs):
            first = next((leg.error for leg in legs if leg.error), None)
            raise Problem(
                502,
                "pipeline_api_unavailable",
                (first or {}).get("detail") or "The pipeline API could not be reached.",
            )
        for leg in legs:
            await batches.insert_leg(
                connection,
                batch_id=batch_id,
                position=leg.position,
                industry=leg.industry,
                client_reference=leg.client_reference,
                job_id=leg.job_id,
                error=leg.error,
            )
        row = await batches.get_batch(connection, batch_id)
    logger.info(
        "batch_created",
        batch_id=str(batch_id),
        scout_id=str(scout["id"]) if scout else None,
        legs=len(legs),
        failed=sum(1 for leg in legs if leg.error),
    )
    return batches.batch_json(
        row,
        [
            {
                "position": leg.position,
                "industry": leg.industry,
                "job_id": leg.job_id,
                "client_reference": leg.client_reference,
                "error": leg.error,
            }
            for leg in legs
        ],
        {leg.job_id: leg.status for leg in legs if leg.job_id},
    )


async def job_statuses(
    pipeline: PipelineClient, job_ids: list[str], role: str
) -> dict[str, str | None]:
    """Parallel `GET /v1/jobs/{id}`; a missing job (404) yields None, other errors too."""
    key_role = "viewer" if role == "viewer" else "operator"

    async def one(job_id: str) -> str | None:
        try:
            job = await pipeline.get_job(job_id, role=key_role)
        except PipelineError:
            return None
        return job.get("status")

    statuses = await asyncio.gather(*(one(job_id) for job_id in job_ids))
    return dict(zip(job_ids, statuses, strict=True))
