"""Health check route used by deployments and uptime monitors."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.modules.health.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Check the service is running", response_model=HealthResponse)
def check_health() -> HealthResponse:
    """Report that the service is up."""
    settings = get_settings()
    return HealthResponse(status="ok", app_name=settings.app_name, environment=settings.environment)
