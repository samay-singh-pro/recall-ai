import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User

pytestmark = pytest.mark.anyio


async def test_a_saved_user_can_be_read_back(session: AsyncSession) -> None:
    user = User(email="asha@example.com", password_hash="not-a-real-hash")
    session.add(user)
    await session.commit()
    session.expunge_all()

    saved = await session.get(User, user.id)

    assert saved is not None
    assert saved.email == "asha@example.com"
    assert saved.password_hash == "not-a-real-hash"


async def test_two_users_cannot_share_an_email(session: AsyncSession) -> None:
    session.add(User(email="asha@example.com", password_hash="first"))
    await session.commit()

    session.add(User(email="asha@example.com", password_hash="second"))

    with pytest.raises(IntegrityError):
        await session.commit()
