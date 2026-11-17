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


async def test_list_returns_only_my_memories_newest_first_with_the_total(
    client: AsyncClient,
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    for content in ["first", "second", "third"]:
        await client.post(MEMORIES_URL, json={"content": content}, headers=asha)
    await client.post(MEMORIES_URL, json={"content": "Ravi's secret"}, headers=ravi)

    response = await client.get(MEMORIES_URL, headers=asha)

    assert response.status_code == 200
    body = response.json()
    assert [item["content"] for item in body["items"]] == ["third", "second", "first"]
    assert set(body["items"][0]) == {"id", "content", "created_at"}
    assert (body["total"], body["limit"], body["offset"]) == (3, 20, 0)


async def test_list_pages_with_limit_and_offset(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    for content in ["one", "two", "three", "four", "five"]:
        await client.post(MEMORIES_URL, json={"content": content}, headers=headers)

    response = await client.get(MEMORIES_URL, params={"limit": 2, "offset": 2}, headers=headers)

    body = response.json()
    assert [item["content"] for item in body["items"]] == ["three", "two"]
    assert (body["total"], body["limit"], body["offset"]) == (5, 2, 2)


async def test_list_for_a_new_user_is_empty(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.get(MEMORIES_URL, headers=headers)

    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
async def test_list_with_a_bad_limit_or_offset_returns_422(
    client: AsyncClient, params: dict[str, int]
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.get(MEMORIES_URL, params=params, headers=headers)

    assert response.status_code == 422


async def test_listing_without_logging_in_returns_401(client: AsyncClient) -> None:
    response = await client.get(MEMORIES_URL)

    assert response.status_code == 401
