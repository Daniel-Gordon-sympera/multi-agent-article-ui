"""Login rate limits counted in ui.login_attempts (per e-mail and per IP)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from scout_bff.errors import Problem


@dataclass(frozen=True)
class LimitRule:
    prefix: str
    window_seconds: int
    max_failures: int


EMAIL_RULE = LimitRule("email", 15 * 60, 10)
IP_RULE = LimitRule("ip", 60 * 60, 60)


def attempt_key(rule: LimitRule, value: str) -> str:
    return f"{rule.prefix}:{value.strip().lower()}"


async def failures_in_window(
    connection: AsyncConnection, rule: LimitRule, value: str
) -> int:
    result = await connection.scalar(
        text(
            "SELECT count(*) FROM ui.login_attempts WHERE key = :key "
            "AND at > now() - make_interval(secs => :window)"
        ),
        {"key": attempt_key(rule, value), "window": rule.window_seconds},
    )
    return int(result or 0)


async def enforce_login_limits(
    connection: AsyncConnection, email: str, ip: str | None
) -> None:
    """Raise 429 too_many_attempts when either window is exhausted."""
    for rule, value in ((EMAIL_RULE, email), (IP_RULE, ip)):
        if not value:
            continue
        if await failures_in_window(connection, rule, value) >= rule.max_failures:
            problem = Problem(
                429,
                "too_many_attempts",
                "Too many sign-in attempts. Try again later.",
            )
            problem.headers = {"Retry-After": str(rule.window_seconds)}
            raise problem


async def record_failure(
    connection: AsyncConnection, email: str, ip: str | None
) -> None:
    keys = [attempt_key(EMAIL_RULE, email)]
    if ip:
        keys.append(attempt_key(IP_RULE, ip))
    await connection.execute(
        text("INSERT INTO ui.login_attempts(key) SELECT unnest(CAST(:keys AS text[]))"),
        {"keys": keys},
    )


async def clear_failures(connection: AsyncConnection, email: str) -> None:
    await connection.execute(
        text("DELETE FROM ui.login_attempts WHERE key = :key"),
        {"key": attempt_key(EMAIL_RULE, email)},
    )
