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


class LoginRequest(BaseModel):
    """What the browser sends to log in."""

    email: EmailStr = Field(description="The email the account was created with")
    password: str = Field(description="The account's password")

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, email: str) -> str:
        """Match the lowercase email stored at signup."""
        return email.lower()


class TokenResponse(BaseModel):
    """The two tokens a successful login returns."""

    access_token: str = Field(description="Short-lived; sent with every request")
    refresh_token: str = Field(description="Long-lived; swapped for a new access token")


class RefreshRequest(BaseModel):
    """What the browser sends to get a new access token."""

    refresh_token: str = Field(description="The refresh token received at login")


class AccessTokenResponse(BaseModel):
    """A fresh access token."""

    access_token: str = Field(description="Short-lived; sent with every request")


class UserResponse(BaseModel):
    """What the API returns about an account. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime
