"""Database queries for memories. No business rules live here."""

import uuid

from sqlalchemy import delete, func, select
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

    async def list_memories(self, user_id: uuid.UUID, limit: int, offset: int) -> list[Memory]:
        """Return one page of this user's memories, newest first."""
        # id is a tie-breaker so two memories saved at the same moment never swap between pages.
        query = (
            select(Memory)
            .where(Memory.user_id == user_id)
            .order_by(Memory.created_at.desc(), Memory.id)
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(query)
        return list(result.scalars())

    async def count_memories(self, user_id: uuid.UUID) -> int:
        """Return how many memories this user has in all."""
        query = select(func.count()).select_from(Memory).where(Memory.user_id == user_id)
        return await self._session.scalar(query) or 0

    async def find_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> Memory | None:
        """Return this user's memory with this id, or None (also when it is someone else's)."""
        query = select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def remove_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> bool:
        """Delete this user's memory. Returns False if there was nothing of theirs to delete."""
        query = delete(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
        result = await self._session.execute(query)
        await self._session.commit()
        return result.rowcount > 0
