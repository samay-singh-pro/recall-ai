"""Shared base for every table: a UUID id plus created/updated timestamps."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Dialect, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

# Predictable constraint names, so migrations can find and change them on SQLite and Postgres alike.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utc_now() -> datetime:
    """Return the current time in UTC."""
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator[datetime]):
    """A timestamp that is always stored and returned in UTC.

    SQLite drops time zones, so values read back are marked as UTC again here.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Convert a time to UTC before saving it."""
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Timestamps must carry a time zone")
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Mark a loaded time as UTC."""
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class Base(DeclarativeBase):
    """Parent class of every table; adds id, created_at and updated_at."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now, onupdate=utc_now)
