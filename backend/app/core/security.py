"""Password hashing and login tokens."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings
from app.core.errors import InvalidTokenError

# Argon2 with the library's recommended settings. It adds a random "salt" to every hash,
# so the same password gives a different hash each time.
_password_hasher = PasswordHasher()

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"


def hash_password(password: str) -> str:
    """Turn a password into the hash that is stored in the database."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if the password matches the stored hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: uuid.UUID) -> str:
    """Create the short-lived token the browser shows on every request."""
    lifetime = timedelta(minutes=get_settings().access_token_minutes)
    return _create_token(user_id, ACCESS_TOKEN, lifetime)


def create_refresh_token(user_id: uuid.UUID) -> str:
    """Create the long-lived token that can be swapped for a new access token."""
    lifetime = timedelta(days=get_settings().refresh_token_days)
    return _create_token(user_id, REFRESH_TOKEN, lifetime)


def read_user_id_from_token(token: str, expected_type: str) -> uuid.UUID:
    """Check a token and return the user id inside it. Raises InvalidTokenError if bad."""
    secret = get_settings().jwt_secret.get_secret_value()
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as error:
        # Covers a wrong signature, an expired token and plain garbage
        raise InvalidTokenError from error

    # A refresh token must not work as an access token, and the other way round
    if payload.get("type") != expected_type:
        raise InvalidTokenError

    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as error:
        raise InvalidTokenError from error


def _create_token(user_id: uuid.UUID, token_type: str, lifetime: timedelta) -> str:
    """Sign a token holding the user id, its kind and when it expires."""
    secret = get_settings().jwt_secret.get_secret_value()
    payload = {"sub": str(user_id), "type": token_type, "exp": datetime.now(UTC) + lifetime}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
