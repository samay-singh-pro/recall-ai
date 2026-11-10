import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ACCESS_TOKEN, REFRESH_TOKEN, read_user_id_from_token, verify_password
from app.modules.auth.errors import EmailAlreadyRegisteredError, InvalidCredentialsError
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import LoginRequest, SignupRequest
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


async def test_login_with_the_right_email_and_password_returns_tokens_for_that_user(
    session: AsyncSession,
) -> None:
    service = make_service(session)
    created = await service.signup(
        SignupRequest(email="asha@example.com", password="correct horse")
    )

    tokens = await service.login(LoginRequest(email="Asha@Example.com", password="correct horse"))

    assert read_user_id_from_token(tokens.access_token, ACCESS_TOKEN) == created.id
    assert read_user_id_from_token(tokens.refresh_token, REFRESH_TOKEN) == created.id


async def test_login_with_a_wrong_password_is_refused(session: AsyncSession) -> None:
    service = make_service(session)
    await service.signup(SignupRequest(email="asha@example.com", password="correct horse"))

    with pytest.raises(InvalidCredentialsError):
        await service.login(LoginRequest(email="asha@example.com", password="wrong horse"))


async def test_login_with_an_unknown_email_is_refused(session: AsyncSession) -> None:
    service = make_service(session)

    with pytest.raises(InvalidCredentialsError):
        await service.login(LoginRequest(email="nobody@example.com", password="correct horse"))
