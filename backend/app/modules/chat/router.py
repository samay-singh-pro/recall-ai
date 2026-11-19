"""HTTP route for asking a question about your memories."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.chat.dependencies import get_chat_service
from app.modules.chat.schemas import ChatAnswerResponse, ChatMessageCreate, MemoryAnswerResponse
from app.modules.chat.service import ChatService

router = APIRouter(tags=["chat"])


@router.post(
    "/chat/messages",
    summary="Ask a question and get an answer written from my memories",
    # 200, not 201: nothing is saved, the answer is only worked out and returned.
    status_code=200,
    response_model=ChatAnswerResponse,
)
async def ask_question(
    message: ChatMessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
) -> ChatAnswerResponse:
    """Answer the logged-in user's question using only their own memories."""
    return await service.answer_question(user.id, message.question)


@router.post(
    "/memories/{memory_id}/answers",
    summary="Ask a question about one of my memories",
    # 200, not 201: the answer is only worked out and returned, saving it is a separate step.
    status_code=200,
    response_model=MemoryAnswerResponse,
)
async def ask_about_memory(
    memory_id: uuid.UUID,
    message: ChatMessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
) -> MemoryAnswerResponse:
    """Answer a question about one of the logged-in user's memories, starting from its text."""
    return await service.answer_about_memory(user.id, memory_id, message.question)
