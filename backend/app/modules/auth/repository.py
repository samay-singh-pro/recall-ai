"""Database queries for users. No business rules live here."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.errors import EmailAlreadyRegisteredError
from app.modules.auth.models import User


class UserRepository:
    """Reads and writes rows of the users table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_user_by_email(self, email: str) -> User | None:
        """Return the user with this email, or None if there is no such account."""
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def add_user(self, email: str, password_hash: str) -> User:
        """Save a new user. Raises EmailAlreadyRegisteredError if the email is taken."""
        user = User(email=email, password_hash=password_hash)
        self._session.add(user)
        try:
            await self._session.commit()
        except IntegrityError as error:
            # Two people signing up at the same moment can both pass an "is it free?" check,
            # so the database's unique rule on email is what decides, not a check beforehand.
            await self._session.rollback()
            raise EmailAlreadyRegisteredError from error
        return user
