"""Business rules for memories."""

import uuid

from app.modules.memories.errors import MemoryNotFoundError
from app.modules.memories.repository import MemoryRepository
from app.modules.memories.schemas import MemoryListResponse, MemoryResponse


class MemoryService:
    """Decides what happens when a user saves or reads memories."""

    def __init__(self, memory_repository: MemoryRepository) -> None:
        self._memory_repository = memory_repository

    async def create_memory(self, user_id: uuid.UUID, content: str) -> MemoryResponse:
        """Save a text memory for this user."""
        # The text is already trimmed and checked by MemoryCreate, so we only save it.
        memory = await self._memory_repository.add_memory(user_id, content)
        return MemoryResponse.model_validate(memory)

    async def list_memories(
        self, user_id: uuid.UUID, limit: int, offset: int
    ) -> MemoryListResponse:
        """Return one page of this user's memories, newest first, with their total count."""
        memories = await self._memory_repository.list_memories(user_id, limit, offset)
        total = await self._memory_repository.count_memories(user_id)
        return MemoryListResponse(
            items=[MemoryResponse.model_validate(memory) for memory in memories],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> MemoryResponse:
        """Return one of this user's memories. Raises MemoryNotFoundError if it is not theirs."""
        memory = await self._memory_repository.find_memory(user_id, memory_id)
        if memory is None:
            raise MemoryNotFoundError
        return MemoryResponse.model_validate(memory)

    async def delete_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> None:
        """Delete one of this user's memories. Raises MemoryNotFoundError if it is not theirs."""
        was_deleted = await self._memory_repository.remove_memory(user_id, memory_id)
        if not was_deleted:
            raise MemoryNotFoundError
