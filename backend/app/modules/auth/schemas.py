"""Request and response shapes for the auth routes."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.modules.auth.models import NAME_MAX_LENGTH

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

# Spaces at both ends are removed before the length is checked, so "   " counts as empty.
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH)
]


class SignupRequest(BaseModel):
    """What the browser sends to create an account."""

    name: Name = Field(description="What the app should call the user; need not be unique")
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
    name: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    """What signup and login return: the two tokens and who they belong to."""

    access_token: str = Field(description="Short-lived; sent with every request")
    refresh_token: str = Field(description="Long-lived; swapped for a new access token")
    user: UserResponse = Field(description="The account that was created or logged in")
