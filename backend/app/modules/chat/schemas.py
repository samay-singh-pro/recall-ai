"""Request and response shapes for asking a question about your memories."""

from pydantic import BaseModel, Field

from app.modules.memories.schemas import MemoryResponse

QUESTION_MAX_LENGTH = 500


class ChatMessageCreate(BaseModel):
    """A question the user asks about their memories."""

    question: str = Field(
        min_length=1,
        max_length=QUESTION_MAX_LENGTH,
        description="The question, in plain words",
    )


class ChatAnswerResponse(BaseModel):
    """A short written answer, with the memories it was written from."""

    answer: str = Field(description="The answer, as plain text")
    memories: list[MemoryResponse] = Field(
        description="The memories the answer is based on, best match first; empty if none matched"
    )


class MemoryAnswerResponse(BaseModel):
    """A short answer to a question about one memory."""

    answer: str = Field(description="The answer, as plain text")
