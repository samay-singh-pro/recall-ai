"""Request and response shapes for the memories routes."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.modules.memories.models import TITLE_MAX_LENGTH, AttachmentKind, MemoryType

CONTENT_MAX_LENGTH = 10_000

# Spaces at both ends are removed before the length is checked, so "   " counts as empty.
Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX_LENGTH)
]


class MemoryUpdate(BaseModel):
    """What the browser sends to change a saved memory."""

    title: Title = Field(description="The new title")


class AttachmentResponse(BaseModel):
    """One file saved as part of a memory."""

    id: uuid.UUID
    kind: AttachmentKind
    file_name: str
    file_url: str = Field(description="Where the file can be viewed or downloaded")
    file_size: int = Field(description="Size in bytes")
    preview_rows: list[list[str]] | None = Field(
        description="For spreadsheets: the first rows, header first; otherwise null"
    )


class LinkPreviewResponse(BaseModel):
    """What a saved web page is about, read from the page."""

    title: str
    description: str | None


class MemoryReference(BaseModel):
    """A pointer to another memory: enough to show its title and open it."""

    id: uuid.UUID
    title: str


class MemoryResponse(BaseModel):
    """What the API returns for a saved memory."""

    id: uuid.UUID
    type: MemoryType
    title: str
    raw_text: str | None = Field(description="The typed text; null when only files were saved")
    attachments: list[AttachmentResponse]
    summary: str | None = Field(description="A 1-3 line AI summary; null when there is none")
    link_preview: LinkPreviewResponse | None = Field(
        description="For a saved link: the page's title and description; otherwise null"
    )
    source_memory: MemoryReference | None = Field(
        description="For a saved answer: the memory it was asked about; otherwise null"
    )
    created_at: datetime


class MemoryListResponse(BaseModel):
    """One page of the user's memories, plus how many they have in total."""

    items: list[MemoryResponse] = Field(description="This page's memories, newest first")
    total: int = Field(description="How many memories the user has in all")
    limit: int = Field(description="The page size that was asked for")
    offset: int = Field(description="How many memories were skipped")
