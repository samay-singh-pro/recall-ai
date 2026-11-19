from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from langchain_core.embeddings import DeterministicFakeEmbedding
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import create_engine, create_session_factory
from app.modules.memories.dependencies import get_vector_store


@pytest.fixture
def anyio_backend() -> str:
    """Run `@pytest.mark.anyio` tests on asyncio, the loop FastAPI uses."""
    return "asyncio"


@pytest.fixture(autouse=True)
def isolated_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Point every test at its own throwaway SQLite file, never the dev database."""
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("LOCAL_STORAGE_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fake_search_index(
    isolated_database: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Give every test its own vector store with fake embeddings, so Gemini is never called."""
    monkeypatch.setenv("CHROMA_DIR", str(tmp_path / "chroma"))
    monkeypatch.setattr(
        "app.modules.memories.dependencies.create_embeddings",
        lambda settings: DeterministicFakeEmbedding(size=64),
    )
    get_settings.cache_clear()
    get_vector_store.cache_clear()
    yield
    get_vector_store.cache_clear()


@pytest.fixture
async def engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    """A database with every registered table created, thrown away after the test."""
    engine = create_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """One database session on top of the throwaway database."""
    async with create_session_factory(engine)() as session:
        yield session
