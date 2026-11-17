import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.errors import EmailAlreadyRegisteredError
from app.modules.auth.repository import UserRepository

pytestmark = pytest.mark.anyio


async def test_an_added_user_can_be_found_by_email(session: AsyncSession) -> None:
    repository = UserRepository(session)
    added = await repository.add_user("asha@example.com", "hash-1")
    session.expunge_all()

    found = await repository.find_user_by_email("asha@example.com")

    assert found is not None
    assert found.id == added.id
    assert found.password_hash == "hash-1"


async def test_finding_an_unknown_email_returns_none(session: AsyncSession) -> None:
    repository = UserRepository(session)
    await repository.add_user("asha@example.com", "hash-1")

    assert await repository.find_user_by_email("someone-else@example.com") is None


async def test_adding_a_taken_email_fails_and_keeps_the_first_account(
    session: AsyncSession,
) -> None:
    repository = UserRepository(session)
    await repository.add_user("asha@example.com", "first-hash")

    with pytest.raises(EmailAlreadyRegisteredError):
        await repository.add_user("asha@example.com", "second-hash")

    # The session is still usable after the failure, and the original account is untouched.
    found = await repository.find_user_by_email("asha@example.com")
    assert found is not None
    assert found.password_hash == "first-hash"


async def test_a_user_can_be_found_by_id(session: AsyncSession) -> None:
    repository = UserRepository(session)
    added = await repository.add_user("asha@example.com", "hash-1")
    session.expunge_all()

    found = await repository.find_user_by_id(added.id)

    assert found is not None
    assert found.email == "asha@example.com"


async def test_finding_an_unknown_id_returns_none(session: AsyncSession) -> None:
    assert await UserRepository(session).find_user_by_id(uuid.uuid4()) is None
