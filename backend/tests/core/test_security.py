import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.errors import InvalidTokenError
from app.core.security import (
    ACCESS_TOKEN,
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    hash_password,
    read_user_id_from_token,
    verify_password,
)


def test_hash_does_not_contain_the_password() -> None:
    password_hash = hash_password("correct horse")

    assert "correct horse" not in password_hash


def test_the_right_password_verifies() -> None:
    password_hash = hash_password("correct horse")

    assert verify_password("correct horse", password_hash) is True


def test_a_wrong_password_does_not_verify() -> None:
    password_hash = hash_password("correct horse")

    assert verify_password("wrong horse", password_hash) is False


def test_the_same_password_gives_a_different_hash_each_time() -> None:
    first = hash_password("correct horse")
    second = hash_password("correct horse")

    assert first != second
    assert verify_password("correct horse", first)
    assert verify_password("correct horse", second)


def sign_token(payload: dict[str, object], secret: str | None = None) -> str:
    """Build a token by hand, to test tokens our own code would never create."""
    secret = secret or get_settings().jwt_secret.get_secret_value()
    return jwt.encode(payload, secret, algorithm="HS256")


def test_an_access_token_gives_back_the_same_user_id() -> None:
    user_id = uuid.uuid4()

    token = create_access_token(user_id)

    assert read_user_id_from_token(token, ACCESS_TOKEN) == user_id


def test_a_refresh_token_gives_back_the_same_user_id() -> None:
    user_id = uuid.uuid4()

    token = create_refresh_token(user_id)

    assert read_user_id_from_token(token, REFRESH_TOKEN) == user_id


def test_a_refresh_token_cannot_be_used_as_an_access_token() -> None:
    token = create_refresh_token(uuid.uuid4())

    with pytest.raises(InvalidTokenError):
        read_user_id_from_token(token, ACCESS_TOKEN)


def test_an_expired_token_is_refused() -> None:
    an_hour_ago = datetime.now(UTC) - timedelta(hours=1)
    token = sign_token({"sub": str(uuid.uuid4()), "type": ACCESS_TOKEN, "exp": an_hour_ago})

    with pytest.raises(InvalidTokenError):
        read_user_id_from_token(token, ACCESS_TOKEN)


def test_a_token_signed_with_another_secret_is_refused() -> None:
    in_an_hour = datetime.now(UTC) + timedelta(hours=1)
    payload = {"sub": str(uuid.uuid4()), "type": ACCESS_TOKEN, "exp": in_an_hour}

    other_secret = "a-different-secret-that-is-long-enough"

    with pytest.raises(InvalidTokenError):
        read_user_id_from_token(sign_token(payload, secret=other_secret), ACCESS_TOKEN)


def test_garbage_is_refused() -> None:
    with pytest.raises(InvalidTokenError):
        read_user_id_from_token("this-is-not-a-token", ACCESS_TOKEN)
