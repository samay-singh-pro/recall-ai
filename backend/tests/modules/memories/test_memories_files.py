from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import get_settings
from app.main import create_app

pytestmark = pytest.mark.anyio

SIGNUP_URL = "/api/v1/auth/signup"
MEMORIES_URL = "/api/v1/memories"

PNG = ("photo.png", b"\x89PNG fake image bytes", "image/png")
PDF = ("menu.pdf", b"%PDF-1.4 fake pdf bytes", "application/pdf")
XLSX = (
    "budget.xlsx",
    b"fake sheet bytes",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)


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


def as_upload(*files: tuple[str, bytes, str]) -> list[tuple[str, tuple[str, bytes, str]]]:
    """Shape files the way httpx wants them for a form upload."""
    return [("files", file) for file in files]


async def test_a_file_alone_is_saved_as_a_memory_named_after_it(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(MEMORIES_URL, files=as_upload(PNG), headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "image"
    assert body["title"] == "photo.png"
    assert body["raw_text"] is None
    [attachment] = body["attachments"]
    assert attachment["kind"] == "image"
    assert attachment["file_name"] == "photo.png"
    assert attachment["file_size"] == len(PNG[1])
    assert attachment["file_url"] == (
        f"/api/v1/memories/{body['id']}/attachments/{attachment['id']}/file"
    )
    assert attachment["preview_rows"] is None


async def test_text_decides_the_type_when_sent_with_files(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(
        MEMORIES_URL, data={"text": "Menu for friday"}, files=as_upload(PDF), headers=headers
    )

    body = response.json()
    assert (body["type"], body["title"], body["raw_text"]) == (
        "text",
        "Menu for friday",
        "Menu for friday",
    )
    assert [attachment["kind"] for attachment in body["attachments"]] == ["pdf"]


async def test_several_files_take_the_type_of_the_first_and_a_combined_title(
    client: AsyncClient,
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(MEMORIES_URL, files=as_upload(PDF, PNG, XLSX), headers=headers)

    body = response.json()
    assert (body["type"], body["title"]) == ("pdf", "menu.pdf + 2 more")
    assert [attachment["kind"] for attachment in body["attachments"]] == ["pdf", "image", "excel"]


async def test_a_saved_file_can_be_downloaded_again_exactly_as_sent(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, files=as_upload(PDF), headers=headers)).json()

    response = await client.get(created["attachments"][0]["file_url"], headers=headers)

    assert response.status_code == 200
    assert response.content == PDF[1]
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "menu.pdf" in response.headers["content-disposition"]


async def test_files_show_up_when_reading_and_listing_memories(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, files=as_upload(PNG), headers=headers)).json()

    one = await client.get(f"{MEMORIES_URL}/{created['id']}", headers=headers)
    listed = await client.get(MEMORIES_URL, headers=headers)

    assert one.json() == created
    assert listed.json()["items"] == [created]


async def test_another_users_file_cannot_be_downloaded(client: AsyncClient) -> None:
    asha = await sign_up(client, "asha@example.com")
    ravi = await sign_up(client, "ravi@example.com")
    created = (await client.post(MEMORIES_URL, files=as_upload(PNG), headers=asha)).json()
    url = created["attachments"][0]["file_url"]

    response = await client.get(url, headers=ravi)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "attachment_not_found"
    assert (await client.get(url)).status_code == 401


async def test_a_file_cannot_be_reached_through_another_memory(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")
    first = (await client.post(MEMORIES_URL, files=as_upload(PNG), headers=headers)).json()
    second = (await client.post(MEMORIES_URL, files=as_upload(PDF), headers=headers)).json()
    attachment_id = first["attachments"][0]["id"]

    response = await client.get(
        f"{MEMORIES_URL}/{second['id']}/attachments/{attachment_id}/file", headers=headers
    )

    assert response.status_code == 404


async def test_files_are_stored_on_disk_and_removed_with_the_memory(
    client: AsyncClient, tmp_path: Path
) -> None:
    headers = await sign_up(client, "asha@example.com")
    created = (await client.post(MEMORIES_URL, files=as_upload(PNG, PDF), headers=headers)).json()
    stored = [path for path in (tmp_path / "uploads").rglob("*") if path.is_file()]
    assert len(stored) == 2

    response = await client.delete(f"{MEMORIES_URL}/{created['id']}", headers=headers)

    assert response.status_code == 204
    assert [path for path in (tmp_path / "uploads").rglob("*") if path.is_file()] == []
    assert (
        await client.get(created["attachments"][0]["file_url"], headers=headers)
    ).status_code == 404


@pytest.mark.parametrize(
    "bad_file",
    [
        ("page.html", b"<script>alert(1)</script>", "text/html"),
        ("logo.svg", b"<svg onload=alert(1)/>", "image/svg+xml"),
        ("run.exe", b"MZ", "application/octet-stream"),
    ],
)
async def test_other_file_types_are_refused_with_415_and_nothing_is_saved(
    client: AsyncClient, bad_file: tuple[str, bytes, str], tmp_path: Path
) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(
        MEMORIES_URL, data={"text": "hi"}, files=as_upload(PNG, bad_file), headers=headers
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"
    assert (await client.get(MEMORIES_URL, headers=headers)).json()["total"] == 0
    assert not (tmp_path / "uploads").exists()


async def test_a_file_over_the_size_limit_is_refused_with_413(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")
    monkeypatch.setenv("MAX_FILE_SIZE_MB", "1")
    get_settings.cache_clear()
    one_mb = 1024 * 1024

    too_big = await client.post(
        MEMORIES_URL,
        files=as_upload(("big.png", b"x" * (one_mb + 1), "image/png")),
        headers=headers,
    )
    just_fits = await client.post(
        MEMORIES_URL, files=as_upload(("ok.png", b"x" * one_mb, "image/png")), headers=headers
    )

    assert too_big.status_code == 413
    assert too_big.json()["error"]["code"] == "file_too_large"
    assert just_fits.status_code == 201


async def test_too_many_files_are_refused_with_400(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await sign_up(client, "asha@example.com")
    monkeypatch.setenv("MAX_FILES_PER_MEMORY", "2")
    get_settings.cache_clear()

    too_many = await client.post(MEMORIES_URL, files=as_upload(PNG, PDF, XLSX), headers=headers)
    allowed = await client.post(MEMORIES_URL, files=as_upload(PNG, PDF), headers=headers)

    assert too_many.status_code == 400
    assert too_many.json()["error"]["code"] == "too_many_files"
    assert allowed.status_code == 201


async def test_the_stored_file_name_never_keeps_folder_parts(client: AsyncClient) -> None:
    headers = await sign_up(client, "asha@example.com")

    response = await client.post(
        MEMORIES_URL,
        files=as_upload(("../../etc/evil.png", PNG[1], "image/png")),
        headers=headers,
    )

    assert response.json()["attachments"][0]["file_name"] == "evil.png"
