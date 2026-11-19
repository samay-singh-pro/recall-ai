"""FastAPI dependencies for the chat route."""

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.integrations.llm.factory import create_chat_model
from app.modules.chat.service import ChatService
from app.modules.memories.dependencies import get_memory_service
from app.modules.memories.service import MemoryService


def get_chat_service(
    memory_service: Annotated[MemoryService, Depends(get_memory_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatService:
    """Build the chat service with the memory service and the chat model from the settings."""
    return ChatService(memory_service, create_chat_model(settings))
