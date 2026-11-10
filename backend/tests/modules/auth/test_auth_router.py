from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.main import create_app

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """An HTTP client talking to the app, backed by the throwaway database from `engine`."""
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def test_signup_creates_an_account_and_hides_the_password(client: AsyncClient) -> None:
    response = await client.post(
        SIGNUP_URL, json={"email": "Asha@Example.com", "password": "correct horse"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "asha@example.com"
    assert set(body) == {"id", "email", "created_at"}


async def test_signup_with_a_taken_email_returns_409_in_the_standard_error_shape(
    client: AsyncClient,
) -> None:
    payload = {"email": "asha@example.com", "password": "correct horse"}
    await client.post(SIGNUP_URL, json=payload)

    response = await client.post(SIGNUP_URL, json=payload)

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "email_already_registered",
            "message": "An account with this email already exists.",
        }
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "correct horse"},
        {"email": "asha@example.com", "password": "short"},
        {"email": "asha@example.com"},
    ],
)
async def test_signup_rejects_invalid_input_with_422(
    client: AsyncClient, payload: dict[str, str]
) -> None:
    response = await client.post(SIGNUP_URL, json=payload)

    assert response.status_code == 422
