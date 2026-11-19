import subprocess
import sys
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.main import create_app
from app.modules.memories.dependencies import get_vector_store
from scripts.reindex import reindex

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


def indexed_memories() -> dict[str, dict[str, Any]]:
    """What the vector store holds now: memory id -> its metadata."""
    stored = get_vector_store().get()  # type: ignore[attr-defined]
    return dict(zip(stored["ids"], stored["metadatas"], strict=True))


async def test_reindex_rebuilds_the_index_from_the_database(client: AsyncClient) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    vet = (await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=asha)).json()
    gym = (await client.post(MEMORIES_URL, data={"text": "Gym at 7"}, headers=ravi)).json()
    await client.post(
        MEMORIES_URL,
        files=[("files", ("menu.pdf", b"%PDF-1.4 x", "application/pdf"))],
        headers=asha,
    )
    # Damage the index: lose one note and keep a vector whose memory does not exist any more.
    store = get_vector_store()
    store.delete(ids=[vet["id"]])
    store.add_texts(
        ["Ghost note"], ids=["ghost-id"], metadatas=[{"user_id": "x", "memory_id": "y"}]
    )

    indexed_count = await reindex()

    # Only the two memories with text come back; the file-only one and the ghost do not.
    assert indexed_count == 2
    stored = indexed_memories()
    assert set(stored) == {vet["id"], gym["id"]}
    # Each is filed under its own owner, in the id format search filters on.
    assert stored[vet["id"]]["user_id"] != stored[gym["id"]]["user_id"]
    assert stored[vet["id"]]["memory_id"] == vet["id"]
    for metadata in stored.values():
        assert metadata["user_id"] == str(uuid.UUID(metadata["user_id"]))  # with hyphens
    found = await client.get(f"{MEMORIES_URL}/search", params={"q": "Vet is Dr. Rao"}, headers=asha)
    assert [item["id"] for item in found.json()["items"]] == [vet["id"]]


def test_the_command_on_its_own_loads_every_table_it_needs() -> None:
    # Run in a fresh process: here the whole app is already imported, which hides a missing import.
    code = "import sys, scripts.reindex; assert 'app.modules.auth.models' in sys.modules"

    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)

    assert result.returncode == 0, result.stderr


async def test_reindex_sends_the_texts_in_batches(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")
    for text in ["Vet is Dr. Rao", "Gym at 7", "Mom phone 98765"]:
        await client.post(MEMORIES_URL, data={"text": text}, headers=headers)
    monkeypatch.setattr("app.modules.memories.service.REINDEX_BATCH_SIZE", 2)
    store = get_vector_store()
    batch_sizes: list[int] = []
    original_add_texts = store.aadd_texts

    async def counting_add_texts(texts: list[str], **kwargs: Any) -> list[str]:
        batch_sizes.append(len(texts))
        return await original_add_texts(texts, **kwargs)

    monkeypatch.setattr(store, "aadd_texts", counting_add_texts)

    indexed_count = await reindex()

    assert indexed_count == 3
    assert batch_sizes == [2, 1]
    assert len(indexed_memories()) == 3


async def test_reindex_fails_loudly_when_the_embedding_model_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")
    await client.post(MEMORIES_URL, data={"text": "Gym at 7"}, headers=headers)

    async def broken(*args: object, **kwargs: object) -> None:
        raise RuntimeError("embedding service is down")

    monkeypatch.setattr(get_vector_store(), "aadd_texts", broken)

    with pytest.raises(RuntimeError, match="embedding service is down"):
        await reindex()
