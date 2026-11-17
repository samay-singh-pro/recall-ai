"""Domain errors for the memories module."""

from app.core.errors import DomainError


class MemoryNotFoundError(DomainError):
    """Raised when the memory does not exist or belongs to someone else."""

    # 404 for both cases, so nobody can use it to find out which ids exist.
    status_code = 404
    code = "memory_not_found"
    message = "This memory was not found."
