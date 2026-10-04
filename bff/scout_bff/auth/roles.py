"""Role hierarchy (admin ⊃ operator ⊃ viewer) and the role → pipeline key map."""

from __future__ import annotations

from typing import Any, Literal

Role = Literal["viewer", "operator", "admin"]
ROLES: tuple[str, ...] = ("viewer", "operator", "admin")
_RANK = {role: index for index, role in enumerate(ROLES)}


def is_role(value: str) -> bool:
    return value in _RANK


def role_satisfies(role: str, required: str) -> bool:
    """True when `role` is at least `required` in the hierarchy."""
    return _RANK.get(role, -1) >= _RANK[required]


def pipeline_key_role(role: str) -> Literal["operator", "reader"]:
    return "operator" if role_satisfies(role, "operator") else "reader"


def pipeline_key_for_role(settings: Any, role: str) -> str:
    """admin and operator use the operator key; viewers use the reader key."""
    if pipeline_key_role(role) == "operator":
        return settings.pipeline_operator_key.get_secret_value()
    return settings.pipeline_reader_key.get_secret_value()
