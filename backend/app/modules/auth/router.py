"""HTTP routes for accounts: signup, login and who-am-I; refresh comes later."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_auth_service, get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    summary="Create an account",
    status_code=201,
    response_model=UserResponse,
)
async def signup(
    signup_request: SignupRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    """Sign up with an email and password."""
    return await service.signup(signup_request)


@router.post(
    "/login",
    summary="Log in and get tokens",
    status_code=200,
    response_model=TokenResponse,
)
async def login(
    login_request: LoginRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    """Log in with an email and password."""
    return await service.login(login_request)


@router.post(
    "/refresh",
    summary="Swap a refresh token for a new access token",
    status_code=200,
    response_model=AccessTokenResponse,
)
async def refresh(
    refresh_request: RefreshRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> AccessTokenResponse:
    """Get a new access token without logging in again."""
    return await service.refresh_access_token(refresh_request.refresh_token)


@router.get(
    "/me",
    summary="Get the logged-in account",
    status_code=200,
    response_model=UserResponse,
)
async def read_current_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Return the account the access token belongs to."""
    return user
