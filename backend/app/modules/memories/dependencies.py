"""FastAPI dependencies for the memories routes."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.memories.repository import MemoryRepository
from app.modules.memories.service import MemoryService


def get_memory_service(session: Annotated[AsyncSession, Depends(get_session)]) -> MemoryService:
    """Build the memory service on this request's database session."""
    return MemoryService(MemoryRepository(session))
