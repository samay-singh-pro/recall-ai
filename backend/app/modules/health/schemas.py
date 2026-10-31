"""Response shapes for the health module."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Result of a health check."""

    status: str = Field(description="'ok' when the service is running")
    app_name: str = Field(description="Name of the running application")
    environment: str = Field(description="Deployment environment, e.g. development")
