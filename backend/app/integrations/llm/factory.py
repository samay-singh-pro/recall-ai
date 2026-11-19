"""Builds the chat model named in the settings."""

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from app.core.config import Settings


def create_chat_model(settings: Settings) -> BaseChatModel:
    """Build the model chosen by LLM_PROVIDER and LLM_MODEL, using that provider's key."""
    secrets = {
        "google_genai": settings.gemini_api_key,
        "groq": settings.groq_api_key,
    }
    provider_secret = secrets[settings.llm_provider].get_secret_value()
    return init_chat_model(
        settings.llm_model,
        model_provider=settings.llm_provider,
        api_key=provider_secret,  # secret-guard:ignore (read from settings, not a literal)
    )
