import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import InvalidTokenError
from app.core.security import (
    ACCESS_TOKEN,
    REFRESH_TOKEN,
    create_access_token,
    read_user_id_from_token,
    verify_password,
)
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


async def test_an_access_token_gives_back_its_user(session: AsyncSession) -> None:
    service = make_service(session)
    created = await service.signup(
        SignupRequest(email="asha@example.com", password="correct horse")
    )
    tokens = await service.login(LoginRequest(email="asha@example.com", password="correct horse"))

    user = await service.get_user_from_access_token(tokens.access_token)

    assert user.id == created.id


async def test_a_refresh_token_is_refused_in_place_of_an_access_token(
    session: AsyncSession,
) -> None:
    service = make_service(session)
    await service.signup(SignupRequest(email="asha@example.com", password="correct horse"))
    tokens = await service.login(LoginRequest(email="asha@example.com", password="correct horse"))

    with pytest.raises(InvalidTokenError):
        await service.get_user_from_access_token(tokens.refresh_token)


async def test_a_valid_token_for_a_missing_account_is_refused(session: AsyncSession) -> None:
    service = make_service(session)
    token_for_nobody = create_access_token(uuid.uuid4())

    with pytest.raises(InvalidTokenError):
        await service.get_user_from_access_token(token_for_nobody)
