"""Business rules for accounts: signing up now, logging in later."""

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
from app.modules.auth.errors import InvalidCredentialsError
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import AccessTokenResponse, LoginRequest, SignupRequest, TokenResponse


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

    async def refresh_access_token(self, refresh_token: str) -> AccessTokenResponse:
        """Swap a valid refresh token for a new access token. Raises InvalidTokenError."""
        # 1. The token must be a genuine, unexpired refresh token
        user_id = read_user_id_from_token(refresh_token, REFRESH_TOKEN)

        # 2. Its account must still exist
        user = await self._user_repository.find_user_by_id(user_id)
        if user is None:
            raise InvalidTokenError

        # 3. Issue a new access token
        return AccessTokenResponse(access_token=create_access_token(user.id))

    async def get_user_from_access_token(self, token: str) -> User:
        """Return the user an access token belongs to. Raises InvalidTokenError if it is bad."""
        user_id = read_user_id_from_token(token, ACCESS_TOKEN)
        user = await self._user_repository.find_user_by_id(user_id)

        # A valid token for an account that no longer exists must not let anyone in
        if user is None:
            raise InvalidTokenError
        return user
