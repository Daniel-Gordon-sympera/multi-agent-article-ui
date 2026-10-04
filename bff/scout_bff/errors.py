"""RFC 9457 problem responses with exactly the pipeline API's shape."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from scout_bff.logging import get_logger

TITLES = {
    400: "Bad request",
    401: "Authentication required",
    403: "Forbidden",
    404: "Not found",
    409: "Conflict",
    410: "Gone",
    422: "Invalid request",
    429: "Too many requests",
    502: "Bad gateway",
    503: "Service unavailable",
    504: "Gateway timeout",
}

logger = get_logger("scout_bff.errors")


class Problem(HTTPException):
    """Raise anywhere in a route; the handler renders application/problem+json."""

    def __init__(self, status: int, category: str, detail: str, **extra: Any) -> None:
        super().__init__(status, detail)
        self.category = category
        self.extra = extra


def problem_body(path: str, status: int, category: str, detail: str, **extra: Any):
    return {
        "type": f"urn:sympera:problem:{category}",
        "title": TITLES.get(status, "Request failed"),
        "status": status,
        "detail": detail,
        "instance": path,
        "error_category": category,
        **extra,
    }


def problem_response(
    request: Request,
    status: int,
    category: str,
    detail: str,
    headers: dict[str, str] | None = None,
    **extra: Any,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content=problem_body(request.url.path, status, category, detail, **extra),
        headers=headers,
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        return problem_response(
            request,
            error.status_code,
            getattr(error, "category", "http_error"),
            str(error.detail),
            headers=getattr(error, "headers", None),
            **getattr(error, "extra", {}),
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError):
        # Validation inputs can contain credentials. Return paths and messages only.
        errors = [
            {"location": list(item["loc"]), "message": item["msg"]}
            for item in error.errors()
        ]
        return problem_response(
            request,
            422,
            "validation_error",
            "Request validation failed.",
            errors=errors,
        )

    @app.exception_handler(SQLAlchemyError)
    async def unavailable(request: Request, error: SQLAlchemyError):
        logger.warning("database_unavailable", error=type(error).__name__)
        return problem_response(
            request, 503, "database_unavailable", "The database is unavailable."
        )

    @app.exception_handler(Exception)
    async def internal_error(request: Request, error: Exception):
        logger.error("internal_error", error=type(error).__name__, exc_info=error)
        return problem_response(
            request, 500, "internal_error", "The request could not be completed."
        )
