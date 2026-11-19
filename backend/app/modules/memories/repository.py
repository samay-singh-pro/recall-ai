"""Database queries for memories and their attachments. No business rules live here."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.memories.models import Attachment, Memory, MemoryType


class MemoryRepository:
    """Reads and writes rows of the memories and attachments tables."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_memory(
        self,
        user_id: uuid.UUID,
        memory_id: uuid.UUID,
        memory_type: MemoryType,
        title: str,
        raw_text: str | None,
        source_url: str | None,
        attachments: list[Attachment],
    ) -> Memory:
        """Save a new memory, with its attachments, that belongs to this user."""
        memory = Memory(
            id=memory_id,
            user_id=user_id,
            type=memory_type,
            title=title,
            raw_text=raw_text,
            source_url=source_url,
            attachments=attachments,
        )
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

    async def list_memories_by_ids(
        self, user_id: uuid.UUID, memory_ids: list[uuid.UUID]
    ) -> list[Memory]:
        """Return the given memories that belong to this user, in no particular order."""
        if not memory_ids:
            return []
        query = select(Memory).where(Memory.user_id == user_id, Memory.id.in_(memory_ids))
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

    async def find_attachment(
        self, user_id: uuid.UUID, memory_id: uuid.UUID, attachment_id: uuid.UUID
    ) -> Attachment | None:
        """Return this user's attachment of this memory, or None (also when it's someone else's)."""
        query = select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.memory_id == memory_id,
            Attachment.user_id == user_id,
        )
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def update_memory_title(
        self, user_id: uuid.UUID, memory_id: uuid.UUID, title: str
    ) -> Memory | None:
        """Change the title of this user's memory. Returns None if they have no such memory."""
        memory = await self.find_memory(user_id, memory_id)
        if memory is None:
            return None
        memory.title = title
        await self._session.commit()
        return memory

    async def remove_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> list[str] | None:
        """Delete this user's memory and its attachment rows.

        Returns the storage paths of its files so the caller can delete them too, or None if
        they have no such memory.
        """
        memory = await self.find_memory(user_id, memory_id)
        if memory is None:
            return None
        file_paths = [attachment.file_path for attachment in memory.attachments]
        await self._session.delete(memory)
        await self._session.commit()
        return file_paths
