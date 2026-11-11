"""FastAPI dependencies: the auth service, and the guard that protects routes."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import InvalidTokenError
from app.db.session import get_session
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.service import AuthService

# Reads "Authorization: Bearer <token>". We raise our own error when it is missing.
bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AuthService:
    """Build the auth service on this request's database session."""
    return AuthService(UserRepository(session))


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    """Return the logged-in user. Any route that lists this as a parameter needs a valid login."""
    if credentials is None:
        raise InvalidTokenError
    return await service.get_user_from_access_token(credentials.credentials)
