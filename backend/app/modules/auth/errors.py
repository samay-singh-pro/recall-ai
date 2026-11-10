"""Domain errors for the auth module."""

from app.core.errors import DomainError


class EmailAlreadyRegisteredError(DomainError):
    """Raised when someone signs up with an email that already has an account."""

    status_code = 409
    code = "email_already_registered"
    message = "An account with this email already exists."


class InvalidCredentialsError(DomainError):
    """Raised when the email or the password is wrong. Never says which one."""

    status_code = 401
    code = "invalid_credentials"
    message = "The email or password is wrong."
