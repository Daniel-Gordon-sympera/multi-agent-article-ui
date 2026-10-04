"""/app/auth/*: sign in, sign out, the current session and password changes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from scout_bff.auth import rate_limit
from scout_bff.auth.csrf import require_requested_with
from scout_bff.auth.deps import (
    AuthenticatedUser,
    client_ip,
    cookie_codec,
    current_user,
)
from scout_bff.auth.passwords import (
    DUMMY_HASH,
    hash_password,
    needs_rehash,
    validate_password_policy,
    verify_password,
)
from scout_bff.auth.sessions import (
    create_session,
    delete_session,
    delete_user_sessions,
)
from scout_bff.errors import Problem
from scout_bff.logging import get_logger
from scout_bff.users import repository as users
from scout_bff.version import __version__

router = APIRouter(prefix="/app/auth", tags=["auth"])
logger = get_logger("scout_bff.auth")


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=1, max_length=1024)


def me_payload(request: Request, user_json: dict, csrf_token: str) -> dict[str, Any]:
    """The `Me` shape of contract §4.3."""
    capabilities = request.app.state.capabilities
    version: dict[str, Any] = {"bff": __version__}
    if capabilities.pipeline_api_version:
        version["pipeline_api"] = capabilities.pipeline_api_version
    return {
        "user": user_json,
        "csrf_token": csrf_token,
        "capabilities": dict(capabilities.capabilities),
        "api": capabilities.api_status(),
        "version": version,
    }


def invalid_credentials() -> Problem:
    return Problem(401, "invalid_credentials", "The e-mail or password is incorrect.")


@router.post("/login", dependencies=[Depends(require_requested_with)])
async def login(request: Request, response: Response, body: LoginRequest) -> dict:
    engine = request.app.state.engine
    settings = request.app.state.settings
    ip = client_ip(request)
    email = body.email.strip()
    async with engine.connect() as connection:
        await rate_limit.enforce_login_limits(connection, email, ip)
        account = await users.credentials_by_email(connection, email)
    password_hash = account["password_hash"] if account else DUMMY_HASH
    verified = verify_password(password_hash, body.password)
    if not verified or account is None or account["disabled_at"] is not None:
        # Own transaction: the failure must be committed before the 401 is raised.
        async with engine.begin() as connection:
            await rate_limit.record_failure(connection, email, ip)
        logger.info("login_failed", ip=ip)
        raise invalid_credentials()
    async with engine.begin() as connection:
        if needs_rehash(password_hash):
            await users.store_password_hash(
                connection, account["id"], hash_password(body.password)
            )
        await rate_limit.clear_failures(connection, email)
        await users.record_login(connection, account["id"])
        session_id, csrf_token = await create_session(
            connection,
            settings,
            account["id"],
            ip=ip,
            user_agent=request.headers.get("user-agent"),
        )
    request.state.user_id = str(account["id"])
    request.state.role = account["role"]
    request.state.audit_target = {"user_id": str(account["id"])}
    cookie_codec(request).set_cookie(response, session_id)
    response.headers["Cache-Control"] = "no-store"
    logger.info("login_succeeded", user_id=str(account["id"]), role=account["role"])
    user_json = {
        key: value
        for key, value in users.user_json(account).items()
        if key not in {"disabled_at", "last_login_at"}
    }
    return me_payload(request, user_json, csrf_token)


@router.post("/logout", status_code=204, response_class=Response)
async def logout(
    request: Request, user: AuthenticatedUser = Depends(current_user)
) -> Response:
    async with request.app.state.engine.begin() as connection:
        await delete_session(connection, user.session_id)
    response = Response(status_code=204)
    cookie_codec(request).clear_cookie(response)
    return response


@router.get("/me")
async def me(
    request: Request,
    response: Response,
    user: AuthenticatedUser = Depends(current_user),
) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return me_payload(request, user.as_json(), user.csrf_token)


@router.post("/password", status_code=204, response_class=Response)
async def change_password(
    request: Request,
    body: PasswordChangeRequest,
    user: AuthenticatedUser = Depends(current_user),
) -> Response:
    try:
        validate_password_policy(body.new_password)
    except ValueError as error:
        raise Problem(422, "weak_password", str(error)) from None
    if body.new_password == body.current_password:
        raise Problem(
            422, "weak_password", "The new password must differ from the current one."
        )
    async with request.app.state.engine.begin() as connection:
        account = await users.credentials_by_email(connection, user.email)
        if account is None or not verify_password(
            account["password_hash"], body.current_password
        ):
            raise Problem(
                403, "invalid_credentials", "The current password is incorrect."
            )
        await users.set_password(
            connection, user.id, body.new_password, must_change_password=False
        )
        await delete_user_sessions(connection, user.id, keep=user.session_id)
    request.state.audit_target = {"user_id": str(user.id)}
    return Response(status_code=204)
