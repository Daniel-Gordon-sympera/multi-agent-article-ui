"""argon2id round trip, policy and rehash detection."""

import pytest

from scout_bff.auth.passwords import (
    DUMMY_HASH,
    hash_password,
    needs_rehash,
    validate_password_policy,
    verify_password,
)


def test_hash_round_trip_is_argon2id_and_salted():
    first, second = hash_password("correct-horse"), hash_password("correct-horse")
    assert first.startswith("$argon2id$")
    assert first != second
    assert verify_password(first, "correct-horse")
    assert verify_password(second, "correct-horse")
    assert not verify_password(first, "wrong-horse")


def test_verify_tolerates_garbage_hashes():
    assert not verify_password("not-a-hash", "anything")
    assert not verify_password("", "anything")
    assert verify_password(DUMMY_HASH, "dummy-password-for-constant-time-login")


def test_needs_rehash_for_current_and_legacy_parameters():
    assert not needs_rehash(hash_password("correct-horse"))
    legacy = "$argon2id$v=19$m=8,t=1,p=1$c2FsdHNhbHRzYWx0$KzFqa2w"
    assert needs_rehash(legacy)
    assert needs_rehash("garbage")


@pytest.mark.parametrize(
    "password, message",
    [
        ("short", "at least 8"),
        (" padded-password", "whitespace"),
        ("x" * 300, "at most 256"),
    ],
)
def test_policy_rejects_weak_passwords(password, message):
    with pytest.raises(ValueError, match=message):
        validate_password_policy(password)


def test_policy_accepts_reasonable_passwords():
    validate_password_policy("scout-admin")
    validate_password_policy("correct horse battery staple")
