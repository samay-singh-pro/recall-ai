"""Business rules for accounts: signing up now, logging in later."""

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.modules.auth.errors import InvalidCredentialsError
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import LoginRequest, SignupRequest, TokenResponse


class AuthService:
    """Decides what happens when someone signs up or logs in."""

    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    async def signup(self, request: SignupRequest) -> User:
        """Create an account. Raises EmailAlreadyRegisteredError if the email is taken."""
        # 1. Never store the password itself, only its hash
        password_hash = hash_password(request.password)

        # 2. Save; the repository refuses a duplicate email
        return await self._user_repository.add_user(request.email, password_hash)

    async def login(self, request: LoginRequest) -> TokenResponse:
        """Check the email and password, then issue tokens. Raises InvalidCredentialsError."""
        # 1. Find the user and check the password
        user = await self._user_repository.find_user_by_email(request.email)

        # One error for both cases, so nobody can use login to find out which emails exist
        if user is None or not verify_password(request.password, user.password_hash):
            raise InvalidCredentialsError

        # 2. Hand out the tokens
        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )
