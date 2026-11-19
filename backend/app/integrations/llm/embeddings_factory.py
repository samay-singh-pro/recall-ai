"""Builds the embedding model named in the settings."""

from langchain.embeddings import init_embeddings
from langchain_core.embeddings import Embeddings

from app.core.config import Settings


def create_embeddings(settings: Settings) -> Embeddings:
    """Build the model chosen by EMBEDDING_PROVIDER and EMBEDDING_MODEL."""
    gemini_secret = settings.gemini_api_key.get_secret_value()
    return init_embeddings(
        settings.embedding_model,
        provider=settings.embedding_provider,
        api_key=gemini_secret,  # secret-guard:ignore (read from settings, not a literal)
    )
