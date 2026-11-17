from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.security import ACCESS_TOKEN, REFRESH_TOKEN, read_user_id_from_token
from app.main import create_app

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
REFRESH_URL = "/api/v1/auth/refresh"

SIGNUP_DETAILS = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
LOGIN_DETAILS = {"email": "asha@example.com", "password": "correct horse"}


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """An HTTP client talking to the app, backed by the throwaway database from `engine`."""
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def bearer(token: str) -> dict[str, str]:
    """The header that shows a token to the API."""
    return {"Authorization": f"Bearer {token}"}


async def test_signup_creates_an_account_logs_it_in_and_hides_the_password(
    client: AsyncClient,
) -> None:
    response = await client.post(
        SIGNUP_URL, json={**SIGNUP_DETAILS, "name": "  Asha  ", "email": "Asha@Example.com"}
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"access_token", "refresh_token", "user"}
    assert set(body["user"]) == {"id", "name", "email", "created_at"}
    assert body["user"]["name"] == "Asha"
    assert body["user"]["email"] == "asha@example.com"
    assert str(read_user_id_from_token(body["access_token"], ACCESS_TOKEN)) == body["user"]["id"]
    assert str(read_user_id_from_token(body["refresh_token"], REFRESH_TOKEN)) == body["user"]["id"]


async def test_signup_with_a_taken_email_returns_409_in_the_standard_error_shape(
    client: AsyncClient,
) -> None:
    await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)

    response = await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)

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
        {**SIGNUP_DETAILS, "email": "not-an-email"},
        {**SIGNUP_DETAILS, "password": "short"},
        {**SIGNUP_DETAILS, "name": ""},
        {**SIGNUP_DETAILS, "name": "   "},
        {**SIGNUP_DETAILS, "name": "x" * 51},
        {"email": "asha@example.com", "password": "correct horse"},
    ],
)
async def test_signup_rejects_invalid_input_with_422(
    client: AsyncClient, payload: dict[str, str]
) -> None:
    response = await client.post(SIGNUP_URL, json=payload)

    assert response.status_code == 422


async def test_login_returns_tokens_and_the_user(client: AsyncClient) -> None:
    signup = await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)

    response = await client.post(LOGIN_URL, json=LOGIN_DETAILS)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"access_token", "refresh_token", "user"}
    assert body["user"] == signup.json()["user"]
    assert body["user"]["name"] == "Asha"
    user_id = read_user_id_from_token(body["access_token"], ACCESS_TOKEN)
    assert str(user_id) == body["user"]["id"]


async def test_login_with_a_wrong_password_returns_401_in_the_standard_error_shape(
    client: AsyncClient,
) -> None:
    await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)

    response = await client.post(
        LOGIN_URL, json={"email": "asha@example.com", "password": "wrong horse"}
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "invalid_credentials", "message": "The email or password is wrong."}
    }


async def test_me_returns_the_logged_in_account(client: AsyncClient) -> None:
    signup = (await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)).json()

    response = await client.get(ME_URL, headers=bearer(signup["access_token"]))

    assert response.status_code == 200
    assert response.json() == signup["user"]


async def test_me_without_a_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_me_with_a_garbage_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(ME_URL, headers=bearer("not-a-real-token"))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_me_with_a_refresh_token_returns_401(client: AsyncClient) -> None:
    signup = (await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)).json()

    response = await client.get(ME_URL, headers=bearer(signup["refresh_token"]))

    assert response.status_code == 401


async def test_refresh_returns_an_access_token_that_works(client: AsyncClient) -> None:
    signup = (await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)).json()

    response = await client.post(REFRESH_URL, json={"refresh_token": signup["refresh_token"]})

    assert response.status_code == 200
    assert set(response.json()) == {"access_token"}
    me = await client.get(ME_URL, headers=bearer(response.json()["access_token"]))
    assert me.json() == signup["user"]


async def test_refresh_with_an_access_token_returns_401(client: AsyncClient) -> None:
    signup = (await client.post(SIGNUP_URL, json=SIGNUP_DETAILS)).json()

    response = await client.post(REFRESH_URL, json={"refresh_token": signup["access_token"]})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_refresh_with_a_garbage_token_returns_401(client: AsyncClient) -> None:
    response = await client.post(REFRESH_URL, json={"refresh_token": "not-a-real-token"})

    assert response.status_code == 401
