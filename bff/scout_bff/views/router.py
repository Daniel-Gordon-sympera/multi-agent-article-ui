"""`GET/POST /app/views`, `PATCH/DELETE /app/views/{id}` — saved views (contract §4.3).

Every signed-in user sees their own views and the `shared` ones; only the owner (or an
admin) may change or delete a view; `UNIQUE (user_id, route, name)` → `409 view_exists`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from scout_bff.auth.deps import AuthenticatedUser, current_user
from scout_bff.errors import Problem
from scout_bff.views import repository as views

router = APIRouter(prefix="/app/views", tags=["views"])

MAX_SEARCH_KEYS = 64


class ViewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    route: str = Field(min_length=1, max_length=200, pattern=r"^/[^\s]*$")
    search: dict[str, Any] = Field(default_factory=dict)
    columns: list[str] | None = Field(default=None, max_length=64)
    shared: bool = False


class ViewPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    search: dict[str, Any] | None = None
    columns: list[str] | None = Field(default=None, max_length=64)
    shared: bool | None = None


def _check_search(search: dict[str, Any] | None) -> None:
    if search is not None and len(search) > MAX_SEARCH_KEYS:
        raise Problem(422, "validation_error", "The view holds too many search keys.")


def _name_taken() -> Problem:
    return Problem(
        409, "view_exists", "You already have a view with this name for this route."
    )


def _assert_owner(view: dict[str, Any], user: AuthenticatedUser) -> None:
    if str(view["user_id"]) != str(user.id) and user.role != "admin":
        raise Problem(403, "forbidden", "Only the owner can change this view.")


def _parse_id(view_id: str) -> UUID:
    try:
        return UUID(view_id)
    except ValueError:
        raise Problem(404, "view_not_found", "The saved view does not exist.") from None


@router.get("")
async def list_views(
    request: Request,
    route: str | None = None,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        rows = await views.list_views(connection, user.id, route)
    return {"items": [views.view_json(row) for row in rows], "next_cursor": None}


@router.post("", status_code=201)
async def create_view(
    request: Request,
    body: ViewCreate,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    _check_search(body.search)
    try:
        async with request.app.state.engine.begin() as connection:
            row = await views.create_view(
                connection,
                user_id=user.id,
                name=body.name.strip(),
                route=body.route,
                search=body.search,
                columns=body.columns,
                shared=body.shared,
            )
    except views.ViewNameTaken:
        raise _name_taken() from None
    return views.view_json(row)


@router.patch("/{view_id}")
async def update_view(
    request: Request,
    view_id: str,
    body: ViewPatch,
    user: AuthenticatedUser = Depends(current_user),
) -> dict[str, Any]:
    _check_search(body.search)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        changes["name"] = changes["name"].strip()
    try:
        async with request.app.state.engine.begin() as connection:
            view = await views.require_view(connection, _parse_id(view_id))
            _assert_owner(view, user)
            row = await views.update_view(connection, view["id"], changes)
    except views.ViewNameTaken:
        raise _name_taken() from None
    return views.view_json(row)


@router.delete("/{view_id}", status_code=204)
async def delete_view(
    request: Request, view_id: str, user: AuthenticatedUser = Depends(current_user)
) -> Response:
    async with request.app.state.engine.begin() as connection:
        view = await views.require_view(connection, _parse_id(view_id))
        _assert_owner(view, user)
        await views.delete_view(connection, view["id"])
    return Response(status_code=204)
