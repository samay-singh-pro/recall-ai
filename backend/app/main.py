"""FastAPI application factory. Only wiring lives here, no logic."""

from fastapi import FastAPI

from app.core.config import get_settings
from app.modules.health.router import router as health_router


def create_app() -> FastAPI:
    """Build the app and register every module's router."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.include_router(health_router, prefix=settings.api_prefix)
    return app


app = create_app()
