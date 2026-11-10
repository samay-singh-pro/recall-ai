"""HTTP routes for accounts: signup now, login and refresh later."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import SignupRequest, UserResponse
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AuthService:
    """FastAPI dependency: build the auth service on this request's database session."""
    return AuthService(UserRepository(session))


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
