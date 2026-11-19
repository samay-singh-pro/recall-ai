"""FastAPI dependencies for the memories routes."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.integrations.file_storage.factory import create_file_storage
from app.modules.memories.repository import MemoryRepository
from app.modules.memories.service import MemoryService

BYTES_PER_MB = 1024 * 1024


def get_memory_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> MemoryService:
    """Build the memory service on this request's database session and the configured storage."""
    return MemoryService(
        MemoryRepository(session),
        create_file_storage(settings),
        settings.api_prefix,
        max_file_bytes=settings.max_file_size_mb * BYTES_PER_MB,
        max_files=settings.max_files_per_memory,
    )
