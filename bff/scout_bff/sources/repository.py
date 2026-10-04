"""SQL for ui.sources and ui.dismissed_suggestions (contract §4.3, §4.8)."""

from __future__ import annotations

import json
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.errors import Problem
from scout_bff.sources.states import normalise_county

SOURCE_COLUMNS = (
    "id, name, domain, url, county, state_code, industries, origin, finder, status, "
    "created_by, created_at, removed_at"
)
COUNTY_MATCH = (
    "lower(regexp_replace(county, '\\s+county$', '', 'i')) = "
    "lower(regexp_replace(:county, '\\s+county$', '', 'i'))"
)


class SourceExists(Exception):
    """Another row already has this (domain, county, state_code)."""


def _iso(value: Any) -> str | None:
    return value.isoformat() if value else None


def source_json(row: dict[str, Any], precision: dict[str, Any] | None = None) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "domain": row["domain"],
        "url": row["url"],
        "county": row["county"],
        "state_code": row["state_code"],
        "industries": list(row["industries"] or []),
        "origin": row["origin"],
        "finder": row["finder"],
        "status": row["status"],
        "created_by": str(row["created_by"]) if row["created_by"] else None,
        "created_at": _iso(row["created_at"]),
        "removed_at": _iso(row["removed_at"]),
        "precision": precision,
    }


def _like(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def list_sources(
    connection: AsyncConnection,
    *,
    county: str | None = None,
    state: str | None = None,
    industry: str | None = None,
    origin: str | None = None,
    status: str = "active",
    q: str | None = None,
) -> list[dict[str, Any]]:
    conditions, parameters = [], {}
    if status in ("active", "removed"):
        conditions.append("status = :status")
        parameters["status"] = status
    if county:
        conditions.append(COUNTY_MATCH)
        parameters["county"] = county
    if state:
        conditions.append("state_code = :state")
        parameters["state"] = state.upper()
    if industry:
        conditions.append(
            "EXISTS (SELECT 1 FROM unnest(industries) AS i WHERE lower(i) = lower(:ind))"
        )
        parameters["ind"] = industry
    if origin:
        conditions.append("origin = :origin")
        parameters["origin"] = origin
    if q:
        conditions.append("(name ILIKE :q ESCAPE '\\' OR domain ILIKE :q ESCAPE '\\')")
        parameters["q"] = _like(q.strip())
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    result = await connection.execute(
        text(
            f"SELECT {SOURCE_COLUMNS} FROM ui.sources {where} "
            "ORDER BY status, state_code, county, name"
        ),
        parameters,
    )
    return [dict(row) for row in result.mappings().all()]


async def source_stats(connection: AsyncConnection) -> dict[str, int]:
    row = (
        (
            await connection.execute(
                text(
                    "SELECT count(*) FILTER (WHERE status = 'active') AS active, "
                    "count(*) FILTER (WHERE status = 'active' AND origin = 'finder') "
                    "AS promoted, "
                    "count(*) FILTER (WHERE status = 'removed') AS removed, "
                    "count(DISTINCT (lower(county), state_code)) "
                    "FILTER (WHERE status = 'active') AS counties FROM ui.sources"
                )
            )
        )
        .mappings()
        .one()
    )
    return {
        key: int(row[key] or 0) for key in ("active", "promoted", "removed", "counties")
    }


async def get_source(connection: AsyncConnection, source_id: UUID) -> dict | None:
    result = await connection.execute(
        text(f"SELECT {SOURCE_COLUMNS} FROM ui.sources WHERE id = :id"),
        {"id": source_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def require_source(connection: AsyncConnection, source_id: UUID) -> dict:
    row = await get_source(connection, source_id)
    if row is None:
        raise Problem(404, "source_not_found", "The source does not exist.")
    return row


async def create_source(
    connection: AsyncConnection,
    *,
    name: str,
    domain: str,
    url: str,
    county: str,
    state_code: str,
    industries: list[str],
    origin: str,
    finder: dict[str, Any] | None,
    created_by: UUID | None,
) -> dict[str, Any]:
    try:
        result = await connection.execute(
            text(
                "INSERT INTO ui.sources(id, name, domain, url, county, state_code, "
                "industries, origin, finder, created_by) VALUES (:id, :name, :domain, "
                ":url, :county, :state_code, CAST(:industries AS text[]), :origin, "
                f"CAST(:finder AS jsonb), :created_by) RETURNING {SOURCE_COLUMNS}"
            ),
            {
                "id": uuid.uuid4(),
                "name": name,
                "domain": domain,
                "url": url,
                "county": normalise_county(county),
                "state_code": state_code,
                "industries": industries,
                "origin": origin,
                "finder": json.dumps(finder) if finder is not None else None,
                "created_by": created_by,
            },
        )
    except IntegrityError as error:
        raise SourceExists(domain) from error
    return dict(result.mappings().one())


async def update_source(
    connection: AsyncConnection, source_id: UUID, changes: dict[str, Any]
) -> dict[str, Any]:
    """Applies `changes` (already validated columns); raises SourceExists on a clash."""
    if not changes:
        return await require_source(connection, source_id)
    assignments = []
    parameters: dict[str, Any] = {"id": source_id}
    for column, value in changes.items():
        marker = (
            f"CAST(:{column} AS text[])" if column == "industries" else f":{column}"
        )
        assignments.append(f"{column} = {marker}")
        parameters[column] = value
    try:
        result = await connection.execute(
            text(
                f"UPDATE ui.sources SET {', '.join(assignments)} WHERE id = :id "
                f"RETURNING {SOURCE_COLUMNS}"
            ),
            parameters,
        )
    except IntegrityError as error:
        raise SourceExists(str(changes.get("domain"))) from error
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "source_not_found", "The source does not exist.")
    return dict(row)


async def set_source_status(
    connection: AsyncConnection, source_id: UUID, status: str
) -> dict[str, Any]:
    result = await connection.execute(
        text(
            "UPDATE ui.sources SET status = :status, removed_at = CASE WHEN "
            ":status = 'removed' THEN coalesce(removed_at, now()) ELSE NULL END "
            f"WHERE id = :id RETURNING {SOURCE_COLUMNS}"
        ),
        {"id": source_id, "status": status},
    )
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "source_not_found", "The source does not exist.")
    return dict(row)


async def listed_domains(
    connection: AsyncConnection, county: str | None, state: str | None
) -> set[str]:
    """Domains already in ui.sources (any status) for a county/state, or everywhere."""
    conditions, parameters = [], {}
    if county:
        conditions.append(COUNTY_MATCH)
        parameters["county"] = county
    if state:
        conditions.append("state_code = :state")
        parameters["state"] = state.upper()
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    result = await connection.execute(
        text(f"SELECT DISTINCT domain FROM ui.sources {where}"), parameters
    )
    return {row[0] for row in result.all()}


async def listed_keys(connection: AsyncConnection) -> set[tuple[str, str, str]]:
    """(domain, county casefolded, state_code) of every row — for import and suggestions."""
    result = await connection.execute(
        text("SELECT domain, county, state_code FROM ui.sources")
    )
    return {(d, normalise_county(c).casefold(), s) for d, c, s in result.all()}


async def dismissed_keys(connection: AsyncConnection) -> set[tuple[str, str, str]]:
    result = await connection.execute(
        text("SELECT domain, county, state_code FROM ui.dismissed_suggestions")
    )
    return {(d, normalise_county(c).casefold(), s) for d, c, s in result.all()}


async def dismiss_suggestion(
    connection: AsyncConnection,
    *,
    domain: str,
    county: str,
    state_code: str,
    user_id: UUID,
) -> None:
    await connection.execute(
        text(
            "INSERT INTO ui.dismissed_suggestions(domain, county, state_code, "
            "dismissed_by) VALUES (:domain, :county, :state_code, :user_id) "
            "ON CONFLICT (domain, county, state_code) DO UPDATE SET "
            "dismissed_by = EXCLUDED.dismissed_by, dismissed_at = now()"
        ),
        {
            "domain": domain,
            "county": normalise_county(county),
            "state_code": state_code,
            "user_id": user_id,
        },
    )


async def active_seed_sources(
    connection: AsyncConnection,
    *,
    county: str,
    state_code: str,
    industries: list[str],
) -> list[dict[str, Any]]:
    """Active sources of a county/state; with industries, those listing any of them
    (sources without industries always match)."""
    parameters: dict[str, Any] = {"county": county, "state": state_code.upper()}
    industry_clause = ""
    if industries:
        industry_clause = (
            " AND (cardinality(industries) = 0 OR EXISTS (SELECT 1 FROM unnest(industries)"
            " AS i, unnest(CAST(:industries AS text[])) AS w WHERE lower(i) = lower(w)))"
        )
        parameters["industries"] = industries
    result = await connection.execute(
        text(
            f"SELECT {SOURCE_COLUMNS} FROM ui.sources WHERE status = 'active' AND "
            f"{COUNTY_MATCH} AND state_code = :state{industry_clause} "
            "ORDER BY name"
        ),
        parameters,
    )
    return [dict(row) for row in result.mappings().all()]


async def source_locations(connection: AsyncConnection) -> list[tuple[str, str]]:
    """Distinct (county, state_code) pairs of active sources, most common first."""
    result = await connection.execute(
        text(
            "SELECT county, state_code FROM ui.sources WHERE status = 'active' "
            "GROUP BY county, state_code ORDER BY count(*) DESC, county"
        )
    )
    return [(county, state) for county, state in result.all()]
