from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.config import get_settings


@pytest.fixture
def anyio_backend() -> str:
    """Run `@pytest.mark.anyio` tests on asyncio, the loop FastAPI uses."""
    return "asyncio"


@pytest.fixture(autouse=True)
def isolated_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Point every test at its own throwaway SQLite file, never the dev database."""
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
