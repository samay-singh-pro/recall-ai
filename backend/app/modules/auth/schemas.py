"""Request and response shapes for the auth routes."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class SignupRequest(BaseModel):
    """What the browser sends to create an account."""

    email: EmailStr = Field(description="Used to log in; stored in lowercase")
    password: str = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
        description="Plain password; only its hash is ever stored",
    )

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, email: str) -> str:
        """Treat A@x.com and a@x.com as the same account."""
        return email.lower()


class UserResponse(BaseModel):
    """What the API returns about an account. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime
