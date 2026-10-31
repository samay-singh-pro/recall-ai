"""Application settings, read once from environment variables and the .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed configuration for the whole backend."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Recall AI"
    environment: str = "development"
    api_prefix: str = "/api/v1"


@lru_cache
def get_settings() -> Settings:
    """Return the shared settings instance."""
    return Settings()
