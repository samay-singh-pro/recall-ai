"""HTTP routes for memories. For now: save a text memory."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.memories.dependencies import get_memory_service
from app.modules.memories.schemas import MemoryCreate, MemoryListResponse, MemoryResponse
from app.modules.memories.service import MemoryService

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

router = APIRouter(prefix="/memories", tags=["memories"])


@router.post(
    "",
    summary="Save a text memory",
    status_code=201,
    response_model=MemoryResponse,
)
async def create_memory(
    memory_create: MemoryCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
) -> MemoryResponse:
    """Save some text for the logged-in user."""
    return await service.create_memory(user.id, memory_create.content)


@router.get(
    "",
    summary="List my memories",
    status_code=200,
    response_model=MemoryListResponse,
)
async def list_memories(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, description="Memories per page")] = (
        DEFAULT_PAGE_SIZE
    ),
    offset: Annotated[int, Query(ge=0, description="How many memories to skip")] = 0,
) -> MemoryListResponse:
    """Return the logged-in user's memories, newest first, one page at a time."""
    return await service.list_memories(user.id, limit, offset)
