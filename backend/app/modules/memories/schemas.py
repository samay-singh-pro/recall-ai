"""Request and response shapes for the memories routes."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CONTENT_MAX_LENGTH = 10_000

# Spaces at both ends are removed before the length is checked, so "   " counts as empty.
Content = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=CONTENT_MAX_LENGTH)
]


class MemoryCreate(BaseModel):
    """What the browser sends to save a text memory."""

    content: Content = Field(description="The text the user wants to remember")


class MemoryResponse(BaseModel):
    """What the API returns for a saved memory."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    created_at: datetime


class MemoryListResponse(BaseModel):
    """One page of the user's memories, plus how many they have in total."""

    items: list[MemoryResponse] = Field(description="This page's memories, newest first")
    total: int = Field(description="How many memories the user has in all")
    limit: int = Field(description="The page size that was asked for")
    offset: int = Field(description="How many memories were skipped")
