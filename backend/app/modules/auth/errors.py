"""Domain errors for the auth module."""

from app.core.errors import DomainError


class EmailAlreadyRegisteredError(DomainError):
    """Raised when someone signs up with an email that already has an account."""

    status_code = 409
    code = "email_already_registered"
    message = "An account with this email already exists."
