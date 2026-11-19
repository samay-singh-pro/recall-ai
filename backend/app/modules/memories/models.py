"""Database tables for the things a user saves: memories and their attached files."""

import enum
import uuid

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

TITLE_MAX_LENGTH = 200
FILE_NAME_MAX_LENGTH = 255


class MemoryType(enum.StrEnum):
    """What a memory mainly is: set by the typed text if there is any, else by the first file."""

    TEXT = "text"
    IMAGE = "image"
    PDF = "pdf"
    EXCEL = "excel"
    LINK = "link"
    MAP = "map"


class AttachmentKind(enum.StrEnum):
    """What kind of file an attachment is."""

    IMAGE = "image"
    PDF = "pdf"
    EXCEL = "excel"


def text_enum(enum_class: type[enum.StrEnum]) -> Enum:
    """A column type that stores an enum as plain text ("text", "link", ...), not a database enum.

    Plain text keeps SQLite and Postgres behaving the same.
    """
    return Enum(
        enum_class, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]
    )


class Attachment(Base):
    """One file saved as part of a memory. Inherits id, created_at and updated_at from Base."""

    __tablename__ = "attachments"

    memory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("memories.id"), index=True)
    # Also on the row (not only through the memory) so every query can filter by the owner.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[AttachmentKind] = mapped_column(text_enum(AttachmentKind))
    # The name the user's file had, shown in the app.
    file_name: Mapped[str] = mapped_column(String(FILE_NAME_MAX_LENGTH))
    # Where the file storage keeps it (not the name above, so two files can share a name).
    file_path: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(String(100))
    # For spreadsheets: the first rows, header first. Filled later; empty for now.
    preview_rows: Mapped[list[list[str]] | None] = mapped_column(JSON)
    # Text read out of the file (OCR, PDF text). Filled later; empty for now.
    extracted_text: Mapped[str | None] = mapped_column(Text)


class Memory(Base):
    """One saved memory. Inherits id, created_at and updated_at from Base."""

    __tablename__ = "memories"

    # Who owns this memory. Indexed because every query filters by it.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[MemoryType] = mapped_column(text_enum(MemoryType))
    # Made from the text or file names when saved; the user can rename it.
    title: Mapped[str] = mapped_column(String(TITLE_MAX_LENGTH))
    # What the user typed. Text (not String) because it can be long; empty if only files are saved.
    raw_text: Mapped[str | None] = mapped_column(Text)
    # The columns below stay empty until the AI parts exist: summary, link reading, saved answers.
    summary: Mapped[str | None] = mapped_column(Text)
    link_title: Mapped[str | None] = mapped_column(Text)
    link_description: Mapped[str | None] = mapped_column(Text)
    # The address, for a link or map memory.
    source_url: Mapped[str | None] = mapped_column(Text)
    # For a saved answer: the memory it was asked about.
    source_memory_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("memories.id"))
    # "selectin" loads the files together with the memory (async code cannot load them later).
    # Deleting the memory deletes its attachment rows.
    attachments: Mapped[list[Attachment]] = relationship(
        cascade="all, delete-orphan", order_by=Attachment.created_at, lazy="selectin"
    )
