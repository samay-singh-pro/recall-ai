"""Alembic entry point: runs migrations against the database from app settings."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.base import Base

# Every module's models must be imported here so autogenerate can see their tables.

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

DATABASE_URL = get_settings().database_url
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Print the SQL instead of running it (`alembic upgrade head --sql`)."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations(connection: Connection) -> None:
    """Apply pending migrations over an open connection."""
    # Batch mode rebuilds a table to change it, because SQLite cannot alter most columns in place.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Connect to the database and apply pending migrations."""
    # A plain engine on purpose: the app's SQLite foreign-key switch would break table rebuilds.
    engine = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
