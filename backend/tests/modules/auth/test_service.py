import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.modules.auth.errors import EmailAlreadyRegisteredError
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import SignupRequest
from app.modules.auth.service import AuthService

pytestmark = pytest.mark.anyio


def make_service(session: AsyncSession) -> AuthService:
    return AuthService(UserRepository(session))


async def test_signup_saves_the_user_with_a_hashed_password(session: AsyncSession) -> None:
    service = make_service(session)

    user = await service.signup(SignupRequest(email="Asha@Example.com", password="correct horse"))

    saved = await UserRepository(session).find_user_by_email("asha@example.com")
    assert saved is not None
    assert saved.id == user.id
    assert saved.password_hash != "correct horse"
    assert verify_password("correct horse", saved.password_hash)


async def test_signup_with_a_taken_email_is_refused(session: AsyncSession) -> None:
    service = make_service(session)
    await service.signup(SignupRequest(email="asha@example.com", password="first-password"))

    with pytest.raises(EmailAlreadyRegisteredError):
        await service.signup(SignupRequest(email="ASHA@example.com", password="second-password"))
