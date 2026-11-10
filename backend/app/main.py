"""FastAPI application factory. Only wiring lives here, no logic."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.session import create_engine, create_session_factory
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router


def create_app() -> FastAPI:
    """Build the app, connect the database and register every module's router."""
    settings = get_settings()
    # Creating the engine does not connect yet; connections open on first use.
    engine = create_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.session_factory = create_session_factory(engine)
    register_error_handlers(app)
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(auth_router, prefix=settings.api_prefix)
    return app


app = create_app()
