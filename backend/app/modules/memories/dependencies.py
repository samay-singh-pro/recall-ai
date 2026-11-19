"""FastAPI dependencies for the memories routes."""

from functools import lru_cache
from threading import Lock
from typing import Annotated

from fastapi import Depends
from langchain_core.vectorstores import VectorStore
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.integrations.file_storage.factory import create_file_storage
from app.integrations.llm.embeddings_factory import create_embeddings
from app.integrations.vector.factory import create_vector_store
from app.modules.memories.repository import MemoryRepository
from app.modules.memories.service import MemoryService

BYTES_PER_MB = 1024 * 1024

# Chroma breaks if two requests open it at the same moment, which happens when a page makes
# several calls right after the server starts. The lock makes the others wait for the first.
_vector_store_lock = Lock()


@lru_cache
def get_vector_store() -> VectorStore:
    """Build the vector store once and reuse it, because opening it is slow."""
    with _vector_store_lock:
        settings = get_settings()
        return create_vector_store(settings, create_embeddings(settings))


def get_memory_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    vector_store: Annotated[VectorStore, Depends(get_vector_store)],
) -> MemoryService:
    """Build the memory service on this request's session, storage and vector store."""
    return MemoryService(
        MemoryRepository(session),
        create_file_storage(settings),
        vector_store,
        settings.api_prefix,
        min_search_score=settings.search_min_score,
        search_score_margin=settings.search_score_margin,
        max_file_bytes=settings.max_file_size_mb * BYTES_PER_MB,
        max_files=settings.max_files_per_memory,
    )
