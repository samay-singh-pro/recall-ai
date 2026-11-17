"""Database queries for memories. No business rules live here."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.memories.models import Memory


class MemoryRepository:
    """Reads and writes rows of the memories table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_memory(self, user_id: uuid.UUID, content: str) -> Memory:
        """Save a new memory that belongs to this user."""
        memory = Memory(user_id=user_id, content=content)
        self._session.add(memory)
        await self._session.commit()
        return memory
