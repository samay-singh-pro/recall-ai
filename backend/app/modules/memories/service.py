"""Business rules for memories."""

import uuid

from app.modules.memories.repository import MemoryRepository
from app.modules.memories.schemas import MemoryResponse


class MemoryService:
    """Decides what happens when a user saves or reads memories."""

    def __init__(self, memory_repository: MemoryRepository) -> None:
        self._memory_repository = memory_repository

    async def create_memory(self, user_id: uuid.UUID, content: str) -> MemoryResponse:
        """Save a text memory for this user."""
        # The text is already trimmed and checked by MemoryCreate, so we only save it.
        memory = await self._memory_repository.add_memory(user_id, content)
        return MemoryResponse.model_validate(memory)
