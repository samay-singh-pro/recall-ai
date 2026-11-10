from typing import Annotated

from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.main import create_app


def test_routes_receive_a_working_database_session() -> None:
    app = create_app()

    @app.get("/session-check")
    async def check_session(session: Annotated[AsyncSession, Depends(get_session)]) -> int:
        return int(await session.scalar(text("SELECT 41 + 1")) or 0)

    with TestClient(app) as client:
        response = client.get("/session-check")

    assert response.json() == 42
