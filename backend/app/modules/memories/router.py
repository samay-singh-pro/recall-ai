"""HTTP routes for memories: save, list, search, read one, download a file, rename, delete."""

import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.memories.dependencies import get_memory_service
from app.modules.memories.schemas import (
    CONTENT_MAX_LENGTH,
    MemoryListResponse,
    MemoryResponse,
    MemorySearchResponse,
    MemoryUpdate,
)
from app.modules.memories.service import MemoryService

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_SEARCH_RESULTS = 5
MAX_SEARCH_RESULTS = 20
QUESTION_MAX_LENGTH = 500

router = APIRouter(prefix="/memories", tags=["memories"])


@router.post(
    "",
    summary="Save a memory (text and/or files)",
    status_code=201,
    response_model=MemoryResponse,
)
async def create_memory(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
    text: Annotated[
        str | None,
        Form(max_length=CONTENT_MAX_LENGTH, description="The text the user wants to remember"),
    ] = None,
    files: Annotated[
        list[UploadFile] | None,
        File(description="Pictures, PDFs or spreadsheets to save with it"),
    ] = None,
) -> MemoryResponse:
    """Save some text and/or files, sent as a form, as one memory for the logged-in user."""
    return await service.create_memory(user.id, text, files or [])


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


# Declared before "/{memory_id}" so the word "search" is not mistaken for a memory id.
@router.get(
    "/search",
    summary="Find my memories closest in meaning to a question",
    status_code=200,
    response_model=MemorySearchResponse,
)
async def search_memories(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
    q: Annotated[
        str,
        Query(min_length=1, max_length=QUESTION_MAX_LENGTH, description="What to look for"),
    ],
    limit: Annotated[
        int, Query(ge=1, le=MAX_SEARCH_RESULTS, description="Most memories to return")
    ] = DEFAULT_SEARCH_RESULTS,
) -> MemorySearchResponse:
    """Return the logged-in user's memories closest in meaning to the question, best first."""
    return await service.search_memories(user.id, q, limit)


@router.get(
    "/{memory_id}",
    summary="Read one memory",
    status_code=200,
    response_model=MemoryResponse,
)
async def get_memory(
    memory_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
) -> MemoryResponse:
    """Return one of the logged-in user's memories."""
    return await service.get_memory(user.id, memory_id)


@router.get(
    "/{memory_id}/attachments/{attachment_id}/file",
    summary="Download a saved file",
    status_code=200,
    response_class=Response,
)
async def download_attachment_file(
    memory_id: uuid.UUID,
    attachment_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
) -> Response:
    """Send back one of the logged-in user's saved files."""
    file = await service.get_attachment_file(user.id, memory_id, attachment_id)
    return Response(
        content=file.data,
        media_type=file.content_type,
        headers={
            # Shown in the browser when possible; the name is encoded so odd characters are safe.
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(file.file_name)}",
            # Never let the browser guess a different type than the one we stored.
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.patch(
    "/{memory_id}",
    summary="Rename a memory",
    status_code=200,
    response_model=MemoryResponse,
)
async def update_memory(
    memory_id: uuid.UUID,
    memory_update: MemoryUpdate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
) -> MemoryResponse:
    """Change the title of one of the logged-in user's memories."""
    return await service.rename_memory(user.id, memory_id, memory_update.title)


@router.delete(
    "/{memory_id}",
    summary="Delete a memory",
    status_code=204,
)
async def delete_memory(
    memory_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MemoryService, Depends(get_memory_service)],
) -> Response:
    """Delete one of the logged-in user's memories."""
    await service.delete_memory(user.id, memory_id)
    return Response(status_code=204)
