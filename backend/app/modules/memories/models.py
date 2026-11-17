"""Database table for the things a user saves."""

import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Memory(Base):
    """One saved memory. Inherits id, created_at and updated_at from Base."""

    __tablename__ = "memories"

    # Who owns this memory. Indexed because every query filters by it.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # Text (not String) because a memory can be long.
    content: Mapped[str] = mapped_column(Text)
