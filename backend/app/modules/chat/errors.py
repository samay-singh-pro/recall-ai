"""Domain errors for the chat module."""

from app.core.errors import DomainError


class AnswerUnavailableError(DomainError):
    """Raised when the chat model cannot write an answer (it is down, over its limit, or empty)."""

    status_code = 503
    code = "answer_unavailable"
    message = "The answer could not be written right now. Please try again in a moment."
