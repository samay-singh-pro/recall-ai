"""Application settings, read once from environment variables and the .env file."""

from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

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

    # Where uploaded files are kept. "local" is a folder on this machine (dev); a "supabase"
    # option will use the Supabase settings below.
    file_storage: Literal["local"] = Field(default="local", description="Which storage to use")
    local_storage_dir: str = Field(
        default="./uploads", description="Folder for uploads when file_storage is local"
    )

    # Supabase Storage. Empty until filled in .env; checked when storage is used.
    supabase_url: str = Field(default="", description="Project URL, e.g. https://<ref>.supabase.co")
    supabase_secret_key: SecretStr = Field(
        default=SecretStr(""), description="Server-only secret key; never sent to the browser"
    )
    supabase_bucket: str = Field(default="memories", description="Private bucket for uploads")

    # The AI model. Switching provider or model is a change here in .env, never in code.
    llm_provider: Literal["google_genai", "groq"] = Field(
        default="google_genai", description="Which company's model to use (google_genai = Gemini)"
    )
    llm_model: str = Field(
        default="gemini-3.5-flash-lite", description="Model name at that provider"
    )
    gemini_api_key: SecretStr = Field(default=SecretStr(""), description="Free key from AI Studio")
    groq_api_key: SecretStr = Field(default=SecretStr(""), description="Free key from Groq console")

    # The model that turns text into numbers for search. Groq has none, so Gemini only for now.
    embedding_provider: Literal["google_genai"] = Field(
        default="google_genai", description="Which company's embedding model to use"
    )
    embedding_model: str = Field(default="gemini-embedding-001", description="Embedding model name")

    # Where memory embeddings are searched. "chroma" is a local folder (dev); a "pgvector" option
    # will use the Postgres database later.
    vector_store: Literal["chroma"] = Field(default="chroma", description="Which store to use")
    chroma_dir: str = Field(
        default="./chroma", description="Folder for the vectors when vector_store is chroma"
    )

    # How close a memory must be to a question to count as a match (0 to 1, higher = stricter).
    # Measured with Gemini: real matches scored 0.64 and up, unrelated notes 0.62 and below.
    search_min_score: float = Field(
        default=0.63, ge=0, le=1, description="Lowest closeness score a search result may have"
    )

    # A result must also be within this distance of the best result's score, so a stray note that
    # only just passes the minimum is dropped when one note is clearly the answer.
    search_score_margin: float = Field(
        default=0.05, ge=0, le=1, description="How far below the best score a result may be"
    )

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
