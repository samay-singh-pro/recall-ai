"""Business rules for accounts: signing up now, logging in later."""

from app.core.security import hash_password
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import SignupRequest


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
