import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import ForeignKey, text
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.session import create_engine, create_session_factory

pytestmark = pytest.mark.anyio


class SampleNote(Base):
    """Throwaway table that exists only for these tests."""

    __tablename__ = "sample_notes"

    text: Mapped[str]


class SampleComment(Base):
    """Throwaway child table, to check foreign keys are enforced."""

    __tablename__ = "sample_comments"

    note_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sample_notes.id"))


@pytest.fixture
async def engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with create_session_factory(engine)() as session:
        yield session


async def test_saving_a_row_fills_id_and_utc_timestamps(session: AsyncSession) -> None:
    note = SampleNote(text="wifi password")
    session.add(note)
    await session.commit()
    session.expunge_all()

    saved = await session.get(SampleNote, note.id)

    assert saved is not None
    assert isinstance(saved.id, uuid.UUID)
    assert saved.created_at.tzinfo == UTC
    assert saved.updated_at.tzinfo == UTC


async def test_changing_a_row_moves_updated_at_forward(session: AsyncSession) -> None:
    long_ago = datetime(2020, 1, 1, tzinfo=UTC)
    note = SampleNote(text="draft", created_at=long_ago, updated_at=long_ago)
    session.add(note)
    await session.commit()

    note.text = "final"
    await session.commit()

    assert note.created_at == long_ago
    assert note.updated_at > long_ago


async def test_time_without_a_time_zone_is_refused(session: AsyncSession) -> None:
    session.add(SampleNote(text="naive", created_at=datetime(2020, 1, 1)))

    with pytest.raises(StatementError, match="time zone"):
        await session.commit()


async def test_sqlite_refuses_links_to_missing_rows(session: AsyncSession) -> None:
    foreign_keys_on = await session.scalar(text("PRAGMA foreign_keys"))
    session.add(SampleComment(note_id=uuid.uuid4()))

    with pytest.raises(IntegrityError):
        await session.commit()
    assert foreign_keys_on == 1
