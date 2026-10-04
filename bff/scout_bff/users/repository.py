"""SQL for ui.users; e-mail uniqueness is case-insensitive through citext."""

from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.auth.passwords import hash_password
from scout_bff.errors import Problem

USER_COLUMNS = (
    "id, email::text AS email, name, role, must_change_password, created_at, "
    "disabled_at, last_login_at"
)


class EmailExists(Exception):
    """Raised when another account already uses the e-mail address."""


def user_json(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "must_change_password": row["must_change_password"],
        "created_at": row["created_at"].isoformat(),
        "disabled_at": row["disabled_at"].isoformat() if row["disabled_at"] else None,
        "last_login_at": (
            row["last_login_at"].isoformat() if row["last_login_at"] else None
        ),
    }


async def count_users(connection: AsyncConnection) -> int:
    return int(await connection.scalar(text("SELECT count(*) FROM ui.users")) or 0)


async def list_users(connection: AsyncConnection) -> list[dict[str, Any]]:
    result = await connection.execute(
        text(f"SELECT {USER_COLUMNS} FROM ui.users ORDER BY created_at, email")
    )
    return [dict(row) for row in result.mappings().all()]


async def get_user(connection: AsyncConnection, user_id: UUID) -> dict | None:
    result = await connection.execute(
        text(f"SELECT {USER_COLUMNS} FROM ui.users WHERE id = :id"), {"id": user_id}
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def require_user(connection: AsyncConnection, user_id: UUID) -> dict[str, Any]:
    user = await get_user(connection, user_id)
    if user is None:
        raise Problem(404, "user_not_found", "The user does not exist.")
    return user


async def credentials_by_email(
    connection: AsyncConnection, email: str
) -> dict[str, Any] | None:
    """The row needed to verify a sign-in, including the password hash."""
    result = await connection.execute(
        text(
            f"SELECT {USER_COLUMNS}, password_hash FROM ui.users "
            "WHERE email = CAST(:email AS citext)"
        ),
        {"email": email.strip()},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def create_user(
    connection: AsyncConnection,
    *,
    email: str,
    name: str,
    role: str,
    password: str,
    must_change_password: bool = False,
) -> dict[str, Any]:
    user_id = uuid.uuid4()
    try:
        result = await connection.execute(
            text(
                "INSERT INTO ui.users(id, email, name, role, password_hash, "
                "must_change_password) VALUES (:id, CAST(:email AS citext), :name, "
                f":role, :password_hash, :must_change) RETURNING {USER_COLUMNS}"
            ),
            {
                "id": user_id,
                "email": email.strip(),
                "name": name.strip(),
                "role": role,
                "password_hash": hash_password(password),
                "must_change": must_change_password,
            },
        )
    except IntegrityError as error:
        raise EmailExists(email) from error
    return dict(result.mappings().one())


async def update_user(
    connection: AsyncConnection,
    user_id: UUID,
    *,
    name: str | None = None,
    role: str | None = None,
    disabled: bool | None = None,
) -> dict[str, Any]:
    assignments, parameters = [], {"id": user_id}
    if name is not None:
        assignments.append("name = :name")
        parameters["name"] = name.strip()
    if role is not None:
        assignments.append("role = :role")
        parameters["role"] = role
    if disabled is not None:
        assignments.append(
            "disabled_at = CASE WHEN :disabled THEN coalesce(disabled_at, now()) "
            "ELSE NULL END"
        )
        parameters["disabled"] = disabled
    if not assignments:
        return await require_user(connection, user_id)
    result = await connection.execute(
        text(
            f"UPDATE ui.users SET {', '.join(assignments)} WHERE id = :id "
            f"RETURNING {USER_COLUMNS}"
        ),
        parameters,
    )
    row = result.mappings().first()
    if row is None:
        raise Problem(404, "user_not_found", "The user does not exist.")
    return dict(row)


async def set_password(
    connection: AsyncConnection,
    user_id: UUID,
    password: str,
    *,
    must_change_password: bool,
) -> None:
    result = await connection.execute(
        text(
            "UPDATE ui.users SET password_hash = :password_hash, "
            "must_change_password = :must_change WHERE id = :id"
        ),
        {
            "id": user_id,
            "password_hash": hash_password(password),
            "must_change": must_change_password,
        },
    )
    if not result.rowcount:
        raise Problem(404, "user_not_found", "The user does not exist.")


async def store_password_hash(
    connection: AsyncConnection, user_id: UUID, password_hash: str
) -> None:
    """Used for transparent rehashing after a successful sign-in."""
    await connection.execute(
        text("UPDATE ui.users SET password_hash = :hash WHERE id = :id"),
        {"id": user_id, "hash": password_hash},
    )


async def record_login(connection: AsyncConnection, user_id: UUID) -> None:
    await connection.execute(
        text("UPDATE ui.users SET last_login_at = now() WHERE id = :id"),
        {"id": user_id},
    )
