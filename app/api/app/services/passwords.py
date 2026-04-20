from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, encoded: str) -> bool:
    try:
        return _hasher.verify(encoded, plain)
    except (VerifyMismatchError, InvalidHash):
        return False
