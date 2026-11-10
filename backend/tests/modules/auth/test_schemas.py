import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.modules.auth.models import User
from app.modules.auth.schemas import SignupRequest, UserResponse


def test_signup_email_is_lowercased() -> None:
    request = SignupRequest(email="Asha@Example.COM", password="longenough")

    assert request.email == "asha@example.com"


def test_signup_rejects_a_short_password() -> None:
    with pytest.raises(ValidationError, match="at least 8"):
        SignupRequest(email="asha@example.com", password="short")


def test_signup_rejects_something_that_is_not_an_email() -> None:
    with pytest.raises(ValidationError):
        SignupRequest(email="not-an-email", password="longenough")


def test_user_response_never_includes_the_password_hash() -> None:
    user = User(
        id=uuid.uuid4(),
        email="asha@example.com",
        password_hash="secret-hash",
        created_at=datetime.now(UTC),
    )

    body = UserResponse.model_validate(user).model_dump()

    assert body["email"] == "asha@example.com"
    assert "password_hash" not in body
