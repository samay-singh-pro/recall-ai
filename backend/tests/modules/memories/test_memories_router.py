import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.documents import Document
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.main import create_app
from app.modules.memories.dependencies import get_vector_store
from app.modules.memories.models import Memory

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
MEMORIES_URL = "/api/v1/memories"
MEMORY_FIELDS = {
    "id",
    "type",
    "title",
    "raw_text",
    "attachments",
    "summary",
    "link_preview",
    "source_memory",
    "created_at",
}


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

    response = await client.post(MEMORIES_URL, data={"text": "  Vet is Dr. Rao  "}, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert set(body) == MEMORY_FIELDS
    assert body["raw_text"] == "Vet is Dr. Rao"
    assert body["title"] == "Vet is Dr. Rao"
    assert body["type"] == "text"
    # Not filled in yet: files, AI summary, link reading and saved answers come later.
    assert body["attachments"] == []
    assert (body["summary"], body["link_preview"], body["source_memory"]) == (None, None, None)


async def test_the_memory_is_stored_under_the_logged_in_user(
    client: AsyncClient, engine: AsyncEngine
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")

    await client.post(MEMORIES_URL, data={"text": "Asha's note"}, headers=asha)
    await client.post(MEMORIES_URL, data={"text": "Ravi's note"}, headers=ravi)

    async with async_sessionmaker(engine)() as session:
        memories = (await session.execute(select(Memory))).scalars().all()
    owners = {memory.raw_text: memory.user_id for memory in memories}
    assert len(memories) == 2
    assert owners["Asha's note"] != owners["Ravi's note"]


async def test_saving_nothing_returns_400_empty_memory(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    for text in ["", "   "]:
        response = await client.post(MEMORIES_URL, data={"text": text}, headers=headers)

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "empty_memory"


async def test_too_long_text_is_rejected_with_422(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(MEMORIES_URL, data={"text": "x" * 10_001}, headers=headers)

    assert response.status_code == 422


async def test_saving_without_logging_in_returns_401(client: AsyncClient) -> None:
    response = await client.post(MEMORIES_URL, data={"text": "hello"})

    assert response.status_code == 401


async def test_list_returns_only_my_memories_newest_first_with_the_total(
    client: AsyncClient,
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    for content in ["first", "second", "third"]:
        await client.post(MEMORIES_URL, data={"text": content}, headers=asha)
    await client.post(MEMORIES_URL, data={"text": "Ravi's secret"}, headers=ravi)

    response = await client.get(MEMORIES_URL, headers=asha)

    assert response.status_code == 200
    body = response.json()
    assert [item["raw_text"] for item in body["items"]] == ["third", "second", "first"]
    assert set(body["items"][0]) == MEMORY_FIELDS
    assert (body["total"], body["limit"], body["offset"]) == (3, 20, 0)


async def test_list_pages_with_limit_and_offset(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    for content in ["one", "two", "three", "four", "five"]:
        await client.post(MEMORIES_URL, data={"text": content}, headers=headers)

    response = await client.get(MEMORIES_URL, params={"limit": 2, "offset": 2}, headers=headers)

    body = response.json()
    assert [item["raw_text"] for item in body["items"]] == ["three", "two"]
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


async def test_a_user_can_read_one_of_their_memories(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "hello"}, headers=headers)).json()

    response = await client.get(f"{MEMORIES_URL}/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json() == created


async def test_reading_an_unknown_memory_returns_404_in_the_standard_error_shape(
    client: AsyncClient,
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.get(f"{MEMORIES_URL}/{uuid.uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "memory_not_found", "message": "This memory was not found."}
    }


async def test_another_users_memory_cannot_be_read_or_deleted(client: AsyncClient) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "private"}, headers=asha)).json()
    url = f"{MEMORIES_URL}/{created['id']}"

    assert (await client.get(url, headers=ravi)).status_code == 404
    assert (await client.delete(url, headers=ravi)).status_code == 404
    # Ravi's failed delete must not have removed Asha's memory.
    assert (await client.get(url, headers=asha)).status_code == 200


async def test_deleting_a_memory_removes_it(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "bye"}, headers=headers)).json()
    url = f"{MEMORIES_URL}/{created['id']}"

    response = await client.delete(url, headers=headers)

    assert response.status_code == 204
    assert (await client.get(url, headers=headers)).status_code == 404
    assert (await client.get(MEMORIES_URL, headers=headers)).json()["total"] == 0


async def test_deleting_an_unknown_memory_returns_404(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.delete(f"{MEMORIES_URL}/{uuid.uuid4()}", headers=headers)

    assert response.status_code == 404


async def test_reading_or_deleting_without_logging_in_returns_401(client: AsyncClient) -> None:
    url = f"{MEMORIES_URL}/{uuid.uuid4()}"

    assert (await client.get(url)).status_code == 401
    assert (await client.delete(url)).status_code == 401


@pytest.mark.parametrize(
    ("text", "expected_type"),
    [
        ("call the vet", "text"),
        ("https://example.com/dress", "link"),
        ("https://maps.app.goo.gl/abc123", "map"),
        ("https://www.google.com/maps/place/Cafe", "map"),
        ("see https://example.com for more", "text"),
    ],
)
async def test_the_type_is_worked_out_from_the_text(
    client: AsyncClient, text: str, expected_type: str
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(MEMORIES_URL, data={"text": text}, headers=headers)

    assert response.json()["type"] == expected_type


async def test_the_title_is_the_first_line_cut_to_60_characters(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    short = await client.post(
        MEMORIES_URL, data={"text": "Gym plan\nlegs on monday"}, headers=headers
    )
    long = await client.post(MEMORIES_URL, data={"text": "x" * 100}, headers=headers)

    assert short.json()["title"] == "Gym plan"
    assert long.json()["title"] == "x" * 60


async def test_a_saved_link_keeps_its_address_in_the_text(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(
        MEMORIES_URL, data={"text": "https://example.com/dress"}, headers=headers
    )

    assert response.json()["raw_text"] == "https://example.com/dress"


async def test_renaming_a_memory_changes_only_its_title(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "vet 98765"}, headers=headers)).json()
    url = f"{MEMORIES_URL}/{created['id']}"

    response = await client.patch(url, json={"title": "  Vet number  "}, headers=headers)

    assert response.status_code == 200
    assert response.json() == {**created, "title": "Vet number"}
    assert (await client.get(url, headers=headers)).json()["title"] == "Vet number"


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
async def test_renaming_to_an_empty_or_too_long_title_returns_422(
    client: AsyncClient, title: str
) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "hello"}, headers=headers)).json()

    response = await client.patch(
        f"{MEMORIES_URL}/{created['id']}", json={"title": title}, headers=headers
    )

    assert response.status_code == 422


async def test_another_users_memory_cannot_be_renamed(client: AsyncClient) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    created = (await client.post(MEMORIES_URL, data={"text": "private"}, headers=asha)).json()
    url = f"{MEMORIES_URL}/{created['id']}"

    response = await client.patch(url, json={"title": "hacked"}, headers=ravi)

    assert response.status_code == 404
    assert (await client.get(url, headers=asha)).json()["title"] == "private"


async def test_renaming_an_unknown_memory_returns_404_and_without_login_401(
    client: AsyncClient,
) -> None:
    headers = await sign_up(client, "asha@example.com")
    url = f"{MEMORIES_URL}/{uuid.uuid4()}"

    assert (await client.patch(url, json={"title": "x"}, headers=headers)).status_code == 404
    assert (await client.patch(url, json={"title": "x"})).status_code == 401


async def test_saved_text_can_be_found_by_meaning_and_is_removed_on_delete(
    client: AsyncClient,
) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)
    memory_id = created.json()["id"]
    store = get_vector_store()

    found = store.similarity_search("Vet is Dr. Rao", k=1)
    assert [(doc.page_content, doc.metadata["memory_id"]) for doc in found] == [
        ("Vet is Dr. Rao", memory_id)
    ]
    assert found[0].metadata["user_id"]

    await client.delete(f"{MEMORIES_URL}/{memory_id}", headers=headers)
    assert store.similarity_search("Vet is Dr. Rao", k=1) == []


async def test_a_file_only_memory_adds_nothing_to_the_search_index(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    await client.post(
        MEMORIES_URL,
        files=[("files", ("menu.pdf", b"%PDF-1.4 x", "application/pdf"))],
        headers=headers,
    )

    assert get_vector_store().similarity_search("menu", k=1) == []


async def test_the_memory_is_still_saved_when_the_search_index_fails(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")

    async def broken(*args: object, **kwargs: object) -> None:
        raise RuntimeError("embedding service is down")

    monkeypatch.setattr(get_vector_store(), "aadd_texts", broken)

    response = await client.post(MEMORIES_URL, data={"text": "Gym at 7"}, headers=headers)

    assert response.status_code == 201
    assert (
        await client.get(f"{MEMORIES_URL}/{response.json()['id']}", headers=headers)
    ).status_code == 200


async def test_search_returns_only_memories_that_are_close_enough(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    for text in ["Vet is Dr. Rao", "Mom phone 98765", "Gym at 7 this evening"]:
        await client.post(MEMORIES_URL, data={"text": text}, headers=headers)

    # The fake embedding model only treats identical text as close, so one memory passes the
    # cut-off even though three are saved and room for five was asked for.
    response = await client.get(
        f"{MEMORIES_URL}/search", params={"q": "Mom phone 98765", "limit": 5}, headers=headers
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["raw_text"] for item in items] == ["Mom phone 98765"]
    assert set(items[0]) == MEMORY_FIELDS


async def test_search_returns_nothing_when_no_memory_is_close(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)

    response = await client.get(
        f"{MEMORIES_URL}/search", params={"q": "tax return deadline"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_search_never_returns_another_users_memories(client: AsyncClient) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    await client.post(MEMORIES_URL, data={"text": "Asha secret locker 4321"}, headers=asha)

    response = await client.get(
        f"{MEMORIES_URL}/search", params={"q": "Asha secret locker 4321"}, headers=ravi
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_search_needs_a_question_and_a_login(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    assert (await client.get(f"{MEMORIES_URL}/search", headers=headers)).status_code == 422
    assert (await client.get(f"{MEMORIES_URL}/search", params={"q": "x"})).status_code == 401


async def test_search_drops_a_match_that_is_far_below_the_best_one(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")
    saved = []
    for text in ["Rent is due by the 5th", "Rent receipt in the drawer", "Flight leaves 14 March"]:
        response = await client.post(MEMORIES_URL, data={"text": text}, headers=headers)
        saved.append(response.json())

    async def scored(question: str, k: int, filter: dict[str, str]):
        # All three are above the minimum score (0.63); only the first two are near the best.
        return [
            (Document(page_content=memory["raw_text"], metadata={"memory_id": memory["id"]}), score)
            for memory, score in zip(saved, [0.76, 0.73, 0.64], strict=True)
        ]

    monkeypatch.setattr(get_vector_store(), "asimilarity_search_with_relevance_scores", scored)

    response = await client.get(
        f"{MEMORIES_URL}/search", params={"q": "when do I pay rent"}, headers=headers
    )

    assert [item["raw_text"] for item in response.json()["items"]] == [
        "Rent is due by the 5th",
        "Rent receipt in the drawer",
    ]
