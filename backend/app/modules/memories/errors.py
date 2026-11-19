"""Domain errors for the memories module."""

from app.core.errors import DomainError


class MemoryNotFoundError(DomainError):
    """Raised when the memory does not exist or belongs to someone else."""

    # 404 for both cases, so nobody can use it to find out which ids exist.
    status_code = 404
    code = "memory_not_found"
    message = "This memory was not found."


class AttachmentNotFoundError(DomainError):
    """Raised when the file does not exist or belongs to someone else's memory."""

    status_code = 404
    code = "attachment_not_found"
    message = "This file was not found."


class EmptyMemoryError(DomainError):
    """Raised when a memory is saved with neither text nor a file."""

    status_code = 400
    code = "empty_memory"
    message = "Add some text or at least one file."


class TooManyFilesError(DomainError):
    """Raised when more files are sent than one memory may hold."""

    status_code = 400
    code = "too_many_files"
    message = "Too many files in one memory."


class FileTooLargeError(DomainError):
    """Raised when one file is bigger than the allowed size."""

    status_code = 413
    code = "file_too_large"
    message = "A file is too large."


class UnsupportedFileTypeError(DomainError):
    """Raised when a file is not a picture, a PDF or a spreadsheet."""

    status_code = 415
    code = "unsupported_file_type"
    message = (
        "Only pictures (PNG, JPEG, GIF, WebP), PDFs and spreadsheets (XLSX, XLS, CSV) can be saved."
    )
