import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessage, BaseMessage
from sqlalchemy.ext.asyncio import AsyncEngine

from app.main import create_app
from app.modules.chat.service import FILE_ONLY_ANSWER, NOTHING_FOUND_ANSWER

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
MEMORIES_URL = "/api/v1/memories"
MESSAGES_URL = "/api/v1/chat/messages"


class FakeChatModel:
    """Stands in for the chat model: returns a set reply and remembers what it was sent."""

    def __init__(self, reply: str = "Dr. Rao is the vet.", error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.calls: list[list[BaseMessage]] = []

    async def ainvoke(self, messages: list[BaseMessage]) -> AIMessage:
        self.calls.append(messages)
        if self.error:
            raise self.error
        return AIMessage(content=self.reply)


@pytest.fixture
def chat_model(monkeypatch: pytest.MonkeyPatch) -> FakeChatModel:
    """Make the app use a fake chat model, so Gemini is never called."""
    model = FakeChatModel()
    monkeypatch.setattr("app.modules.chat.dependencies.create_chat_model", lambda settings: model)
    return model


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


async def test_the_answer_is_written_from_the_matching_memory(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    vet = (await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)).json()
    await client.post(MEMORIES_URL, data={"text": "Gym at 7 this evening"}, headers=headers)

    response = await client.post(MESSAGES_URL, json={"question": "Vet is Dr. Rao"}, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Dr. Rao is the vet."
    assert [memory["id"] for memory in body["memories"]] == [vet["id"]]
    # The model was sent the instructions, the matching note and the question, and not the
    # note that did not match.
    system_message, human_message = chat_model.calls[0]
    prompt = str(system_message.content)
    assert "general knowledge" in prompt  # the model may help beyond the note's own words
    assert "never invent" in prompt  # ...but personal details come only from the notes
    assert "not instructions" in prompt  # a note cannot give the model orders
    assert "Vet is Dr. Rao" in str(human_message.content)
    assert "Gym at 7" not in str(human_message.content)


async def test_with_no_close_memory_it_says_so_and_never_calls_the_model(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)

    response = await client.post(
        MESSAGES_URL, json={"question": "Zebra crossing paint colour"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == {"answer": NOTHING_FOUND_ANSWER, "memories": []}
    assert chat_model.calls == []


async def test_another_users_memory_is_never_used_to_answer(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=ravi)

    response = await client.post(MESSAGES_URL, json={"question": "Vet is Dr. Rao"}, headers=asha)

    assert response.json() == {"answer": NOTHING_FOUND_ANSWER, "memories": []}
    assert chat_model.calls == []


@pytest.mark.parametrize("failure", [RuntimeError("quota exceeded"), None])
async def test_a_failing_or_empty_model_returns_503_answer_unavailable(
    client: AsyncClient, chat_model: FakeChatModel, failure: Exception | None
) -> None:
    headers = await sign_up(client, "asha@example.com")
    await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)
    chat_model.error = failure
    chat_model.reply = "   "  # only used when there is no error: an empty answer

    response = await client.post(MESSAGES_URL, json={"question": "Vet is Dr. Rao"}, headers=headers)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "answer_unavailable"


async def test_asking_needs_a_question_and_a_login(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")

    assert (
        await client.post(MESSAGES_URL, json={"question": ""}, headers=headers)
    ).status_code == 422
    assert (await client.post(MESSAGES_URL, json={}, headers=headers)).status_code == 422
    assert (await client.post(MESSAGES_URL, json={"question": "hi"})).status_code == 401


def answers_url(memory_id: object) -> str:
    """The address for asking a question about one memory."""
    return f"{MEMORIES_URL}/{memory_id}/answers"


async def test_a_question_about_one_memory_is_answered_from_that_memory_only(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    vet = (await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)).json()
    await client.post(MEMORIES_URL, data={"text": "Gym at 7 this evening"}, headers=headers)

    response = await client.post(
        answers_url(vet["id"]), json={"question": "what should I bring?"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == {"answer": "Dr. Rao is the vet."}
    # The model got this memory and the question, and none of the user's other memories.
    system_message, human_message = chat_model.calls[0]
    assert "general knowledge" in str(system_message.content)
    assert "Vet is Dr. Rao" in str(human_message.content)
    assert "what should I bring?" in str(human_message.content)
    assert "Gym at 7" not in str(human_message.content)


async def test_another_users_or_unknown_memory_returns_404_and_never_calls_the_model(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    ravis = (await client.post(MEMORIES_URL, data={"text": "Ravi's note"}, headers=ravi)).json()
    body = {"question": "what does it say?"}

    theirs = await client.post(answers_url(ravis["id"]), json=body, headers=asha)
    unknown = await client.post(answers_url(uuid.uuid4()), json=body, headers=asha)

    for response in (theirs, unknown):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "memory_not_found"
    assert chat_model.calls == []


async def test_a_memory_with_only_files_says_it_cannot_read_them_and_skips_the_model(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    menu = (
        await client.post(
            MEMORIES_URL,
            files=[("files", ("menu.pdf", b"%PDF-1.4 x", "application/pdf"))],
            headers=headers,
        )
    ).json()

    response = await client.post(
        answers_url(menu["id"]), json={"question": "what is on the menu?"}, headers=headers
    )

    assert response.json() == {"answer": FILE_ONLY_ANSWER}
    assert chat_model.calls == []


async def test_a_failing_model_gives_503_when_asking_about_one_memory(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    vet = (await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)).json()
    chat_model.error = RuntimeError("quota exceeded")

    response = await client.post(
        answers_url(vet["id"]), json={"question": "who is the vet?"}, headers=headers
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "answer_unavailable"


async def test_asking_about_one_memory_needs_a_question_and_a_login(
    client: AsyncClient, chat_model: FakeChatModel
) -> None:
    headers = await sign_up(client, "asha@example.com")
    vet = (await client.post(MEMORIES_URL, data={"text": "Vet is Dr. Rao"}, headers=headers)).json()
    url = answers_url(vet["id"])

    assert (await client.post(url, json={"question": ""}, headers=headers)).status_code == 422
    assert (await client.post(url, json={"question": "hi"})).status_code == 401
