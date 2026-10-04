"""`/app/sources*`: the curated seed list, CSV import, finder suggestions (contract §4.3)."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile

from scout_bff.auth.deps import AuthenticatedUser, current_user, require_role
from scout_bff.errors import Problem
from scout_bff.pipeline_client import KeyRole
from scout_bff.sources import repository as sources
from scout_bff.sources.csv_import import MAX_UPLOAD_BYTES, parse_sources_csv
from scout_bff.sources.domains import (
    InvalidUrl,
    domain_of,
    normalise_domain,
    normalise_url,
)
from scout_bff.sources.models import (
    DismissInput,
    PromoteInput,
    SourceInput,
    SourceUpdate,
)
from scout_bff.sources.precision import median_ratio, precision_by_domain
from scout_bff.sources.states import normalise_county, normalise_state_code
from scout_bff.sources.suggestions import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    SuggestionQuery,
    collect_suggestions,
)

router = APIRouter(prefix="/app/sources", tags=["sources"])
operator = Depends(require_role("operator"))


def key_role(user: AuthenticatedUser) -> KeyRole:
    return "viewer" if user.role == "viewer" else "operator"


def source_exists_problem() -> Problem:
    return Problem(
        409,
        "source_exists",
        "This domain is already listed for the same county and state.",
    )


def invalid_url_problem(error: InvalidUrl) -> Problem:
    return Problem(422, "invalid_url", str(error))


def state_or_422(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    code = normalise_state_code(value)
    if code is None:
        raise Problem(422, "invalid_state", f"Unknown state '{value}'.")
    return code


@router.get("")
async def list_sources(
    request: Request,
    user: AuthenticatedUser = Depends(current_user),
    county: str | None = Query(default=None, max_length=120),
    state: str | None = Query(default=None, max_length=40),
    industry: str | None = Query(default=None, max_length=200),
    origin: Literal["manual", "finder", "csv"] | None = None,
    status: Literal["active", "removed", "all"] = "active",
    q: str | None = Query(default=None, max_length=200),
) -> dict[str, Any]:
    state_code = state_or_422(state)
    engine = request.app.state.engine
    async with engine.connect() as connection:
        rows = await sources.list_sources(
            connection,
            county=county,
            state=state_code,
            industry=industry,
            origin=origin,
            status=status,
            q=q,
        )
        stats: dict[str, Any] = await sources.source_stats(connection)
        active_rows = (
            rows
            if status == "active" and not (county or state or industry or origin or q)
            else await sources.list_sources(connection, status="active")
        )
    capable = bool(
        request.app.state.capabilities.capabilities.get("sources_stats", False)
    )
    precision: dict[str, dict[str, Any] | None] = {}
    if capable:
        domains = [row["domain"] for row in rows] + [
            row["domain"] for row in active_rows
        ]
        precision = await precision_by_domain(
            request.app.state.pipeline, domains, key_role(user)
        )
    stats["median_precision"] = (
        median_ratio([precision.get(row["domain"]) for row in active_rows])
        if capable
        else None
    )
    return {
        "items": [
            sources.source_json(row, precision.get(row["domain"]) if capable else None)
            for row in rows
        ],
        "stats": stats,
    }


@router.get("/suggestions")
async def list_suggestions(
    request: Request,
    user: AuthenticatedUser = Depends(current_user),
    county: str | None = Query(default=None, max_length=120),
    state: str | None = Query(default=None, max_length=40),
    industry: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> dict[str, Any]:
    query = SuggestionQuery(
        county=normalise_county(county) if county else None,
        state=state_or_422(state),
        industry=industry or None,
        limit=limit,
    )
    async with request.app.state.engine.connect() as connection:
        items = await collect_suggestions(
            request.app.state.pipeline, connection, query, key_role(user)
        )
    return {"items": items}


@router.post("", status_code=201, dependencies=[operator])
async def create_source(
    request: Request,
    body: SourceInput,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    try:
        url = normalise_url(body.url)
        domain = normalise_domain(body.domain) if body.domain else domain_of(url)
    except InvalidUrl as error:
        raise invalid_url_problem(error) from None
    try:
        async with request.app.state.engine.begin() as connection:
            row = await sources.create_source(
                connection,
                name=body.name,
                domain=domain,
                url=url,
                county=body.county,
                state_code=body.state_code,
                industries=body.industries,
                origin="manual",
                finder=None,
                created_by=user.id,
            )
    except sources.SourceExists:
        raise source_exists_problem() from None
    request.state.audit_target = {"source_id": str(row["id"]), "domain": domain}
    return sources.source_json(row)


@router.patch("/{source_id}", dependencies=[operator])
async def update_source(
    request: Request, source_id: UUID, body: SourceUpdate
) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    if body.name is not None:
        changes["name"] = " ".join(body.name.split())
    try:
        if body.url is not None:
            changes["url"] = normalise_url(body.url)
            changes["domain"] = domain_of(changes["url"])
        if body.domain is not None:
            changes["domain"] = normalise_domain(body.domain)
    except InvalidUrl as error:
        raise invalid_url_problem(error) from None
    if body.county is not None:
        changes["county"] = body.county
    if body.state_code is not None:
        changes["state_code"] = body.state_code
    if body.industries is not None:
        changes["industries"] = body.industries
    try:
        async with request.app.state.engine.begin() as connection:
            row = await sources.update_source(connection, source_id, changes)
    except sources.SourceExists:
        raise source_exists_problem() from None
    request.state.audit_target = {"source_id": str(source_id)}
    return sources.source_json(row)


@router.delete("/{source_id}", status_code=204, response_class=Response)
async def remove_source(
    request: Request, source_id: UUID, user: AuthenticatedUser = operator
) -> Response:
    async with request.app.state.engine.begin() as connection:
        await sources.set_source_status(connection, source_id, "removed")
    request.state.audit_target = {"source_id": str(source_id)}
    return Response(status_code=204)


@router.post("/{source_id}/restore", dependencies=[operator])
async def restore_source(request: Request, source_id: UUID) -> dict[str, Any]:
    async with request.app.state.engine.begin() as connection:
        row = await sources.set_source_status(connection, source_id, "active")
    request.state.audit_target = {"source_id": str(source_id)}
    return sources.source_json(row)


@router.post("/import", dependencies=[operator])
async def import_sources(
    request: Request,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    parsed = parse_sources_csv(content)
    imported = 0
    async with request.app.state.engine.begin() as connection:
        listed = await sources.listed_keys(connection)
        for row in parsed.rows:
            if row.key in listed:
                parsed.skip(row.row, "already listed for this county and state")
                continue
            await sources.create_source(
                connection,
                name=row.name,
                domain=row.domain,
                url=row.url,
                county=row.county,
                state_code=row.state_code,
                industries=row.industries,
                origin="csv",
                finder=None,
                created_by=user.id,
            )
            listed.add(row.key)
            imported += 1
    parsed.skipped.sort(key=lambda entry: int(str(entry["row"])))
    request.state.audit_target = {
        "imported": imported,
        "skipped": len(parsed.skipped),
        "filename": file.filename,
    }
    return {"imported": imported, "skipped": parsed.skipped}


@router.post("/promote", status_code=201, dependencies=[operator])
async def promote_suggestion(
    request: Request,
    body: PromoteInput,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    suggestion = body.suggestion
    try:
        url = normalise_url(suggestion.url or suggestion.domain)
        domain = normalise_domain(suggestion.domain)
    except InvalidUrl as error:
        raise invalid_url_problem(error) from None
    industries = body.industries
    if industries is None:
        industries = [suggestion.industry] if suggestion.industry else []
    finder = {
        "tier": str(suggestion.tier) if suggestion.tier is not None else None,
        "verdict": suggestion.verdict,
        "reason": suggestion.reason,
        "judged_at": suggestion.judged_at,
        "rank": suggestion.rank,
        "job_id": suggestion.job_id,
        "origin": suggestion.origin,
    }
    try:
        async with request.app.state.engine.begin() as connection:
            row = await sources.create_source(
                connection,
                name=" ".join((body.name or suggestion.name or domain).split()),
                domain=domain,
                url=url,
                county=suggestion.county,
                state_code=suggestion.state_code,
                industries=industries,
                origin="finder",
                finder=finder,
                created_by=user.id,
            )
    except sources.SourceExists:
        raise source_exists_problem() from None
    request.state.audit_target = {"source_id": str(row["id"]), "domain": domain}
    return sources.source_json(row)


@router.post("/dismiss", status_code=204, response_class=Response)
async def dismiss_suggestion(
    request: Request, body: DismissInput, user: AuthenticatedUser = operator
) -> Response:
    try:
        domain = normalise_domain(body.domain)
    except InvalidUrl as error:
        raise invalid_url_problem(error) from None
    async with request.app.state.engine.begin() as connection:
        await sources.dismiss_suggestion(
            connection,
            domain=domain,
            county=body.county,
            state_code=body.state_code,
            user_id=user.id,
        )
    request.state.audit_target = {
        "domain": domain,
        "county": body.county,
        "state_code": body.state_code,
    }
    return Response(status_code=204)
