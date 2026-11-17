from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.main import create_app
from app.modules.memories.models import Memory

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
MEMORIES_URL = "/api/v1/memories"


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """An HTTP client talking to the app, backed by the throwaway database from `engine`."""
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def sign_up(client: AsyncClient, email: str) -> dict[str, str]:
    """Create an account and return the header that proves we are logged in as it."""
    response = await client.post(
        SIGNUP_URL, json={"name": "Asha", "email": email, "password": "correct horse"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def test_a_logged_in_user_saves_a_memory_and_gets_it_back(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(
        MEMORIES_URL, json={"content": "  Vet is Dr. Rao  "}, headers=headers
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "content", "created_at"}
    assert body["content"] == "Vet is Dr. Rao"


async def test_the_memory_is_stored_under_the_logged_in_user(
    client: AsyncClient, engine: AsyncEngine
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")

    await client.post(MEMORIES_URL, json={"content": "Asha's note"}, headers=asha)
    await client.post(MEMORIES_URL, json={"content": "Ravi's note"}, headers=ravi)

    async with async_sessionmaker(engine)() as session:
        memories = (await session.execute(select(Memory))).scalars().all()
    owners = {memory.content: memory.user_id for memory in memories}
    assert len(memories) == 2
    assert owners["Asha's note"] != owners["Ravi's note"]


@pytest.mark.parametrize("content", ["", "   ", "x" * 10_001])
async def test_empty_or_too_long_content_is_rejected_with_422(
    client: AsyncClient, content: str
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(MEMORIES_URL, json={"content": content}, headers=headers)

    assert response.status_code == 422


async def test_saving_without_logging_in_returns_401(client: AsyncClient) -> None:
    response = await client.post(MEMORIES_URL, json={"content": "hello"})

    assert response.status_code == 401
