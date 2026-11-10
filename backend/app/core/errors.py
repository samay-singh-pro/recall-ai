"""Turns expected errors (like "email already taken") into a clean JSON answer."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """Parent of our own errors. Each child says which HTTP status and message to send."""

    status_code = 400
    code = "bad_request"
    message = "The request could not be completed."


class InvalidTokenError(DomainError):
    """Raised when a login token is missing, expired, forged or of the wrong kind."""

    status_code = 401
    code = "invalid_token"
    message = "Your login is missing or has expired. Please log in again."


def register_error_handlers(app: FastAPI) -> None:
    """When any DomainError happens, reply with its status code and a standard JSON body."""

    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, error: DomainError) -> JSONResponse:
        body = {"error": {"code": error.code, "message": error.message}}
        return JSONResponse(status_code=error.status_code, content=body)
