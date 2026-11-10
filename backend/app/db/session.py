"""Database engine and per-request sessions."""

from collections.abc import AsyncIterator
from typing import Any

from fastapi import Request
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def create_engine(database_url: str) -> AsyncEngine:
    """Create the connection pool for the configured database."""
    engine = create_async_engine(database_url)
    if engine.dialect.name == "sqlite":
        # SQLite ignores foreign keys unless asked, so deleting a memory would leave orphan rows.
        event.listen(engine.sync_engine, "connect", _enable_sqlite_foreign_keys)
    return engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create the factory that opens one session per request."""
    # Keep loaded objects usable after commit, so a service can return what it just saved.
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: open a session for this request and close it afterwards."""
    session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with session_factory() as session:
        yield session


def _enable_sqlite_foreign_keys(dbapi_connection: Any, connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
