"""HTTP routes for memories. For now: save a text memory."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.memories.dependencies import get_memory_service
from app.modules.memories.schemas import MemoryCreate, MemoryResponse
from app.modules.memories.service import MemoryService

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
