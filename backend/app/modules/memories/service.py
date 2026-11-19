"""Business rules for memories."""

import logging
import re
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import PurePath
from typing import Protocol

from langchain_core.vectorstores import VectorStore

from app.integrations.file_storage.base import FileStorage
from app.integrations.vector.factory import reset_vector_store
from app.modules.memories.errors import (
    AttachmentNotFoundError,
    EmptyMemoryError,
    FileTooLargeError,
    MemoryNotFoundError,
    TooManyFilesError,
    UnsupportedFileTypeError,
)
from app.modules.memories.models import (
    FILE_NAME_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    Attachment,
    AttachmentKind,
    Memory,
    MemoryType,
)
from app.modules.memories.repository import MemoryRepository
from app.modules.memories.schemas import (
    AttachmentResponse,
    LinkPreviewResponse,
    MemoryListResponse,
    MemoryResponse,
    MemorySearchResponse,
)

logger = logging.getLogger(__name__)

AUTO_TITLE_MAX_LENGTH = 60
# Texts sent to the embedding model per call when rebuilding the index (Gemini allows up to 100).
REINDEX_BATCH_SIZE = 50
# The whole text is one web address (no spaces), or one Google Maps address.
URL_PATTERN = re.compile(r"^https?://\S+$", re.IGNORECASE)
MAP_URL_PATTERN = re.compile(r"^https?://(maps\.app\.goo\.gl|(www\.)?google\.[a-z.]+/maps)", re.I)

# Only these file types are accepted. SVG is left out on purpose: it can carry scripts.
IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
PDF_CONTENT_TYPE = "application/pdf"
EXCEL_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
}


class IncomingFile(Protocol):
    """A file sent by the user. FastAPI's UploadFile fits, and tests can use a simple stand-in."""

    filename: str | None
    content_type: str | None

    async def read(self, size: int = -1) -> bytes:
        """Read up to `size` bytes of the file."""
        ...


@dataclass(frozen=True)
class FileContent:
    """A saved file with its bytes, ready to be sent back to the browser."""

    file_name: str
    content_type: str
    data: bytes


@dataclass(frozen=True)
class _CheckedFile:
    """A file that passed the checks, with what we need to store it."""

    kind: AttachmentKind
    file_name: str
    content_type: str
    data: bytes


class MemoryService:
    """Decides what happens when a user saves or reads memories."""

    def __init__(
        self,
        memory_repository: MemoryRepository,
        file_storage: FileStorage,
        vector_store: VectorStore,
        api_prefix: str,
        max_file_bytes: int,
        max_files: int,
        min_search_score: float,
        search_score_margin: float,
    ) -> None:
        self._memory_repository = memory_repository
        self._file_storage = file_storage
        self._vector_store = vector_store
        self._api_prefix = api_prefix
        self._max_file_bytes = max_file_bytes
        self._max_files = max_files
        self._min_search_score = min_search_score
        self._search_score_margin = search_score_margin

    async def create_memory(
        self, user_id: uuid.UUID, text: str | None, files: Sequence[IncomingFile]
    ) -> MemoryResponse:
        """Save text and/or files as one memory; its type and title are worked out from them."""
        # 1. Something must be saved, and the files must be acceptable
        text = (text or "").strip() or None
        if text is None and not files:
            raise EmptyMemoryError
        checked_files = await self._check_files(files)

        # 2. Work out what kind of memory this is and what to call it
        memory_id = uuid.uuid4()
        memory_type = detect_type(text) if text else MemoryType(checked_files[0].kind)
        is_address = memory_type in (MemoryType.LINK, MemoryType.MAP)
        title = make_title(text) if text else make_file_title(checked_files)

        # 3. Store the files first, then the database rows. If the database fails,
        # the files are removed again so none are left without a memory.
        attachments = [self._new_attachment(user_id, memory_id, file) for file in checked_files]
        for attachment, file in zip(attachments, checked_files, strict=True):
            await self._file_storage.save(attachment.file_path, file.data)
        try:
            memory = await self._memory_repository.add_memory(
                user_id=user_id,
                memory_id=memory_id,
                memory_type=memory_type,
                title=title,
                raw_text=text,
                source_url=text if is_address else None,
                attachments=attachments,
            )
        except Exception:
            for attachment in attachments:
                await self._file_storage.delete(attachment.file_path)
            raise

        # 4. Make the text searchable by meaning
        if text:
            await self._index_text(user_id, memory_id, text)
        return build_memory_response(memory, self._api_prefix)

    async def list_memories(
        self, user_id: uuid.UUID, limit: int, offset: int
    ) -> MemoryListResponse:
        """Return one page of this user's memories, newest first, with their total count."""
        memories = await self._memory_repository.list_memories(user_id, limit, offset)
        total = await self._memory_repository.count_memories(user_id)
        return MemoryListResponse(
            items=[build_memory_response(memory, self._api_prefix) for memory in memories],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def search_memories(
        self, user_id: uuid.UUID, question: str, limit: int
    ) -> MemorySearchResponse:
        """Return this user's memories closest in meaning to the question, best match first."""
        # 1. Ask the vector store, looking only at this user's memories
        scored_matches = await self._vector_store.asimilarity_search_with_relevance_scores(
            question, k=limit, filter={"user_id": str(user_id)}
        )

        # 2. Keep only the really close matches. The store always returns the nearest few, so a
        # match needs a minimum score, and must be near the best one.
        best_score = max((score for _, score in scored_matches), default=0.0)
        lowest_score = max(self._min_search_score, best_score - self._search_score_margin)
        matches = [match for match, score in scored_matches if score >= lowest_score]

        # 3. Load those memories from the database (a match whose memory is gone is dropped)
        memory_ids = [uuid.UUID(match.metadata["memory_id"]) for match in matches]
        memories = await self._memory_repository.list_memories_by_ids(user_id, memory_ids)

        # 4. The database returns them in any order, so put them back in best-match order
        memory_by_id = {memory.id: memory for memory in memories}
        ranked = [memory_by_id[memory_id] for memory_id in memory_ids if memory_id in memory_by_id]
        return MemorySearchResponse(
            items=[build_memory_response(memory, self._api_prefix) for memory in ranked]
        )

    async def get_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> MemoryResponse:
        """Return one of this user's memories. Raises MemoryNotFoundError if it is not theirs."""
        memory = await self._memory_repository.find_memory(user_id, memory_id)
        if memory is None:
            raise MemoryNotFoundError
        return build_memory_response(memory, self._api_prefix)

    async def get_attachment_file(
        self, user_id: uuid.UUID, memory_id: uuid.UUID, attachment_id: uuid.UUID
    ) -> FileContent:
        """Return the bytes of one of this user's files. Raises AttachmentNotFoundError."""
        attachment = await self._memory_repository.find_attachment(
            user_id, memory_id, attachment_id
        )
        if attachment is None:
            raise AttachmentNotFoundError
        try:
            data = await self._file_storage.read(attachment.file_path)
        except FileNotFoundError as error:
            # The row exists but the file is gone from storage; to the user it is just missing.
            raise AttachmentNotFoundError from error
        return FileContent(attachment.file_name, attachment.content_type, data)

    async def rename_memory(
        self, user_id: uuid.UUID, memory_id: uuid.UUID, title: str
    ) -> MemoryResponse:
        """Change the title of one of this user's memories. Raises MemoryNotFoundError."""
        memory = await self._memory_repository.update_memory_title(user_id, memory_id, title)
        if memory is None:
            raise MemoryNotFoundError
        return build_memory_response(memory, self._api_prefix)

    async def delete_memory(self, user_id: uuid.UUID, memory_id: uuid.UUID) -> None:
        """Delete one of this user's memories and its files. Raises MemoryNotFoundError."""
        file_paths = await self._memory_repository.remove_memory(user_id, memory_id)
        if file_paths is None:
            raise MemoryNotFoundError
        for file_path in file_paths:
            await self._file_storage.delete(file_path)
        await self._remove_from_index(memory_id)

    async def reindex_all_memories(self) -> int:
        """Empty the search index and add every memory's text again; return how many were added.

        Used after the embedding model changes, when the old vectors no longer fit. Unlike saving,
        an error here is raised: a half-built index must not look like a finished one.
        """
        # 1. Start from an empty index (a new model can have a different vector size)
        reset_vector_store(self._vector_store)

        # 2. Add the texts in batches, so one embedding call never carries hundreds of them
        memories = await self._memory_repository.list_all_memories_with_text_for_reindex()
        for start in range(0, len(memories), REINDEX_BATCH_SIZE):
            batch = memories[start : start + REINDEX_BATCH_SIZE]
            await self._vector_store.aadd_texts(
                [memory.raw_text or "" for memory in batch],
                metadatas=[
                    {"user_id": str(memory.user_id), "memory_id": str(memory.id)}
                    for memory in batch
                ],
                ids=[str(memory.id) for memory in batch],
            )
        return len(memories)

    async def _index_text(self, user_id: uuid.UUID, memory_id: uuid.UUID, text: str) -> None:
        """Add the text to the vector store. A failure is logged, not shown: the memory is saved."""
        try:
            await self._vector_store.aadd_texts(
                [text],
                metadatas=[{"user_id": str(user_id), "memory_id": str(memory_id)}],
                ids=[str(memory_id)],
            )
        except Exception:
            # The memory is safe in the database; it just isn't searchable until re-indexed.
            logger.exception("Could not index memory %s", memory_id)

    async def _remove_from_index(self, memory_id: uuid.UUID) -> None:
        """Remove a memory from the vector store. A failure is logged, not shown."""
        try:
            await self._vector_store.adelete(ids=[str(memory_id)])
        except Exception:
            logger.exception("Could not remove memory %s from the index", memory_id)

    async def _check_files(self, files: Sequence[IncomingFile]) -> list[_CheckedFile]:
        """Read the files and refuse too many, too large or unsupported ones."""
        if len(files) > self._max_files:
            raise TooManyFilesError

        checked_files = []
        for file in files:
            content_type = (file.content_type or "").split(";")[0].strip().lower()
            kind = detect_file_kind(content_type)
            # Read one byte more than allowed: that is enough to know the file is too big,
            # without loading a huge upload into memory.
            data = await file.read(self._max_file_bytes + 1)
            if len(data) > self._max_file_bytes:
                raise FileTooLargeError
            file_name = PurePath(file.filename or "file").name[:FILE_NAME_MAX_LENGTH]
            checked_files.append(_CheckedFile(kind, file_name or "file", content_type, data))
        return checked_files

    def _new_attachment(
        self, user_id: uuid.UUID, memory_id: uuid.UUID, file: _CheckedFile
    ) -> Attachment:
        """Build the database row for a file, and decide where in storage it will live."""
        attachment_id = uuid.uuid4()
        return Attachment(
            id=attachment_id,
            user_id=user_id,
            kind=file.kind,
            file_name=file.file_name,
            # Built from ids only, never from the user's file name.
            file_path=f"{user_id}/{memory_id}/{attachment_id}",
            file_size=len(file.data),
            content_type=file.content_type,
        )


def detect_type(text: str) -> MemoryType:
    """Say whether the text is a Google Maps address, a web address, or plain text."""
    if MAP_URL_PATTERN.match(text) and URL_PATTERN.match(text):
        return MemoryType.MAP
    if URL_PATTERN.match(text):
        return MemoryType.LINK
    return MemoryType.TEXT


def detect_file_kind(content_type: str) -> AttachmentKind:
    """Say what kind of file this is. Raises UnsupportedFileTypeError for anything else."""
    if content_type in IMAGE_CONTENT_TYPES:
        return AttachmentKind.IMAGE
    if content_type == PDF_CONTENT_TYPE:
        return AttachmentKind.PDF
    if content_type in EXCEL_CONTENT_TYPES:
        return AttachmentKind.EXCEL
    raise UnsupportedFileTypeError


def make_title(text: str) -> str:
    """Use the first line of the text, cut short, as the title."""
    first_line = text.splitlines()[0].strip()
    return first_line[:AUTO_TITLE_MAX_LENGTH]


def make_file_title(files: list[_CheckedFile]) -> str:
    """Name a memory with no text after its first file, e.g. "menu.pdf + 2 more"."""
    first, *others = files
    title = f"{first.file_name} + {len(others)} more" if others else first.file_name
    return title[:TITLE_MAX_LENGTH]


def build_memory_response(memory: Memory, api_prefix: str) -> MemoryResponse:
    """Turn a saved memory into the shape the API returns."""
    link_preview = None
    if memory.link_title is not None:
        link_preview = LinkPreviewResponse(
            title=memory.link_title, description=memory.link_description
        )
    attachments = [
        AttachmentResponse(
            id=attachment.id,
            kind=attachment.kind,
            file_name=attachment.file_name,
            file_url=f"{api_prefix}/memories/{memory.id}/attachments/{attachment.id}/file",
            file_size=attachment.file_size,
            preview_rows=attachment.preview_rows,
        )
        for attachment in memory.attachments
    ]
    return MemoryResponse(
        id=memory.id,
        type=memory.type,
        title=memory.title,
        raw_text=memory.raw_text,
        attachments=attachments,
        summary=memory.summary,
        link_preview=link_preview,
        # Saved answers arrive with the AI agent.
        source_memory=None,
        created_at=memory.created_at,
    )
