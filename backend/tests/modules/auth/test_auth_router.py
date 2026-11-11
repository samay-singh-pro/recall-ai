from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.security import ACCESS_TOKEN, read_user_id_from_token
from app.main import create_app

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
REFRESH_URL = "/api/v1/auth/refresh"


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


async def test_login_returns_tokens_that_belong_to_the_account(client: AsyncClient) -> None:
    credentials = {"email": "asha@example.com", "password": "correct horse"}
    signup = await client.post(SIGNUP_URL, json=credentials)

    response = await client.post(LOGIN_URL, json=credentials)

    assert response.status_code == 200
    tokens = response.json()
    assert set(tokens) == {"access_token", "refresh_token"}
    user_id = read_user_id_from_token(tokens["access_token"], ACCESS_TOKEN)
    assert str(user_id) == signup.json()["id"]


async def test_login_with_a_wrong_password_returns_401_in_the_standard_error_shape(
    client: AsyncClient,
) -> None:
    await client.post(SIGNUP_URL, json={"email": "asha@example.com", "password": "correct horse"})

    response = await client.post(
        LOGIN_URL, json={"email": "asha@example.com", "password": "wrong horse"}
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "invalid_credentials", "message": "The email or password is wrong."}
    }


async def test_me_returns_the_logged_in_account(client: AsyncClient) -> None:
    credentials = {"email": "asha@example.com", "password": "correct horse"}
    signup = await client.post(SIGNUP_URL, json=credentials)
    tokens = (await client.post(LOGIN_URL, json=credentials)).json()

    response = await client.get(
        ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )

    assert response.status_code == 200
    assert response.json() == signup.json()


async def test_me_without_a_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_me_with_a_garbage_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(ME_URL, headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_me_with_a_refresh_token_returns_401(client: AsyncClient) -> None:
    credentials = {"email": "asha@example.com", "password": "correct horse"}
    await client.post(SIGNUP_URL, json=credentials)
    tokens = (await client.post(LOGIN_URL, json=credentials)).json()

    response = await client.get(
        ME_URL, headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )

    assert response.status_code == 401


async def test_refresh_returns_an_access_token_that_works(client: AsyncClient) -> None:
    credentials = {"email": "asha@example.com", "password": "correct horse"}
    signup = await client.post(SIGNUP_URL, json=credentials)
    tokens = (await client.post(LOGIN_URL, json=credentials)).json()

    response = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})

    assert response.status_code == 200
    assert set(response.json()) == {"access_token"}
    me = await client.get(
        ME_URL, headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me.json() == signup.json()


async def test_refresh_with_an_access_token_returns_401(client: AsyncClient) -> None:
    credentials = {"email": "asha@example.com", "password": "correct horse"}
    await client.post(SIGNUP_URL, json=credentials)
    tokens = (await client.post(LOGIN_URL, json=credentials)).json()

    response = await client.post(REFRESH_URL, json={"refresh_token": tokens["access_token"]})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


async def test_refresh_with_a_garbage_token_returns_401(client: AsyncClient) -> None:
    response = await client.post(REFRESH_URL, json={"refresh_token": "not-a-real-token"})

    assert response.status_code == 401
