"""/app/users*: admin-only account management with self-protection rules."""

from __future__ import annotations

import re
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from scout_bff.auth.deps import AuthenticatedUser, require_role
from scout_bff.auth.passwords import validate_password_policy
from scout_bff.auth.roles import role_satisfies
from scout_bff.auth.sessions import delete_user_sessions
from scout_bff.errors import Problem
from scout_bff.users import repository as users

router = APIRouter(
    prefix="/app/users",
    tags=["users"],
    dependencies=[Depends(require_role("admin"))],
)

Role = Literal["admin", "operator", "viewer"]
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    name: str = Field(min_length=1, max_length=200)
    role: Role
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def plausible_email(cls, value: str) -> str:
        value = value.strip()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Enter a valid e-mail address.")
        return value


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: Role | None = None
    disabled: bool | None = None


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_password: str = Field(min_length=1, max_length=1024)


def check_policy(password: str) -> None:
    try:
        validate_password_policy(password)
    except ValueError as error:
        raise Problem(422, "weak_password", str(error)) from None


@router.get("")
async def list_users(request: Request) -> dict[str, Any]:
    async with request.app.state.engine.connect() as connection:
        rows = await users.list_users(connection)
    return {"items": [users.user_json(row) for row in rows], "next_cursor": None}


@router.post("", status_code=201)
async def create_user(request: Request, body: CreateUserRequest) -> dict[str, Any]:
    check_policy(body.password)
    try:
        async with request.app.state.engine.begin() as connection:
            row = await users.create_user(
                connection,
                email=str(body.email),
                name=body.name,
                role=body.role,
                password=body.password,
                must_change_password=True,
            )
    except users.EmailExists:
        raise Problem(
            409, "email_exists", "An account with this e-mail already exists."
        ) from None
    request.state.audit_target = {"user_id": str(row["id"])}
    return users.user_json(row)


@router.patch("/{user_id}")
async def update_user(
    request: Request,
    user_id: UUID,
    body: UpdateUserRequest,
    admin: AuthenticatedUser = Depends(require_role("admin")),
) -> dict[str, Any]:
    if user_id == admin.id:
        if body.disabled:
            raise Problem(
                409, "self_protection", "You cannot disable your own account."
            )
        if body.role is not None and not role_satisfies(body.role, "admin"):
            raise Problem(409, "self_protection", "You cannot demote your own account.")
    async with request.app.state.engine.begin() as connection:
        row = await users.update_user(
            connection,
            user_id,
            name=body.name,
            role=body.role,
            disabled=body.disabled,
        )
        if body.disabled:
            await delete_user_sessions(connection, user_id)
    request.state.audit_target = {"user_id": str(user_id)}
    return users.user_json(row)


@router.post("/{user_id}/password", status_code=204, response_class=Response)
async def reset_password(
    request: Request,
    user_id: UUID,
    body: ResetPasswordRequest,
    admin: AuthenticatedUser = Depends(require_role("admin")),
) -> Response:
    check_policy(body.new_password)
    async with request.app.state.engine.begin() as connection:
        await users.require_user(connection, user_id)
        await users.set_password(
            connection, user_id, body.new_password, must_change_password=True
        )
        keep = admin.session_id if user_id == admin.id else None
        await delete_user_sessions(connection, user_id, keep=keep)
    request.state.audit_target = {"user_id": str(user_id)}
    return Response(status_code=204)
