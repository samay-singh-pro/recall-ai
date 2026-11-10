"""Application settings, read once from environment variables and the .env file."""

from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# One .env at the repo root serves the backend, Docker Compose and the docs; a missing file is fine.
ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

# Fine on your own machine, never acceptable anywhere else.
DEFAULT_JWT_SECRET = "change-me"


class Settings(BaseSettings):
    """Typed configuration for the whole backend."""

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    app_name: str = "Recall AI"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    # SQLite file in dev (relative to backend/); a postgresql+asyncpg:// URL later, no code changes.
    database_url: str = Field(
        default="sqlite+aiosqlite:///./recall.db", description="SQLAlchemy async database URL"
    )

    # File storage (Supabase Storage). Empty until filled in .env; checked when storage is used.
    supabase_url: str = Field(default="", description="Project URL, e.g. https://<ref>.supabase.co")
    supabase_secret_key: SecretStr = Field(
        default=SecretStr(""), description="Server-only secret key; never sent to the browser"
    )
    supabase_bucket: str = Field(default="memories", description="Private bucket for uploads")

    # Upload limits for one dump.
    max_file_size_mb: int = Field(default=10, gt=0, description="Largest allowed file, in MB")
    max_files_per_memory: int = Field(default=5, gt=0, description="Most files in one dump")

    # Login tokens. The secret signs them, so anyone who knows it can forge a login.
    jwt_secret: SecretStr = Field(
        default=SecretStr(DEFAULT_JWT_SECRET), description="Secret used to sign login tokens"
    )
    access_token_minutes: int = Field(default=30, gt=0, description="Life of an access token")
    refresh_token_days: int = Field(default=14, gt=0, description="Life of a refresh token")

    @model_validator(mode="after")
    def refuse_default_secret_outside_development(self) -> Self:
        """Stop the app from starting with the well-known placeholder secret anywhere real."""
        is_placeholder = self.jwt_secret.get_secret_value() == DEFAULT_JWT_SECRET
        if self.environment != "development" and is_placeholder:
            raise ValueError("Set JWT_SECRET to a long random value before deploying")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the shared settings instance."""
    return Settings()
