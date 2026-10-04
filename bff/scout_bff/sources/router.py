"""Placeholder router for `sources`; feature agent A5 (scouts and sources) adds the routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/app", tags=["sources"])
