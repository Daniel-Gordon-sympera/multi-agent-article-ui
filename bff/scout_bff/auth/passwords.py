"""argon2id password hashing with a policy check and rehash detection."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MINIMUM_PASSWORD_LENGTH = 8
MAXIMUM_PASSWORD_LENGTH = 256

_hasher = PasswordHasher()  # argon2id, library defaults (RFC 9106 low-memory)


def validate_password_policy(password: str) -> None:
    """Raise ValueError with a user-facing message when the password is weak."""
    if len(password) < MINIMUM_PASSWORD_LENGTH:
        raise ValueError(
            f"Passwords need at least {MINIMUM_PASSWORD_LENGTH} characters."
        )
    if len(password) > MAXIMUM_PASSWORD_LENGTH:
        raise ValueError(
            f"Passwords may have at most {MAXIMUM_PASSWORD_LENGTH} characters."
        )
    if password.strip() != password:
        raise ValueError("Passwords may not start or end with whitespace.")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


# Verified when the account does not exist so timing does not reveal accounts.
DUMMY_HASH = hash_password("dummy-password-for-constant-time-login")
