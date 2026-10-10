import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_password_hasher = PasswordHasher()

# Verified against when a login names an unknown email, so a failed login
# takes the same time whether or not the account exists.
_DUMMY_HASH = _password_hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _password_hasher.check_needs_rehash(password_hash)


def burn_password_check(password: str) -> None:
    """Spend the same effort as a real verification; result is discarded."""
    verify_password(password, _DUMMY_HASH)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Only this digest is stored, so a leaked database does not leak usable sessions."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
