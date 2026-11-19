from pydantic import SecretStr

from app.core.config import Settings
from app.integrations.llm.factory import create_chat_model


def make_settings(provider: str, model: str) -> Settings:
    """Settings for one provider, with a made-up key so nothing real is needed."""
    return Settings(
        llm_provider=provider,
        llm_model=model,
        gemini_api_key=SecretStr("placeholder"),
        groq_api_key=SecretStr("placeholder"),
    )


def test_builds_the_gemini_model_from_the_settings():
    model = create_chat_model(make_settings("google_genai", "gemini-2.5-flash"))

    assert type(model).__name__ == "ChatGoogleGenerativeAI"
    assert model.model == "gemini-2.5-flash"


def test_switching_the_provider_gives_a_different_model_without_code_changes():
    model = create_chat_model(make_settings("groq", "llama-3.3-70b-versatile"))

    assert type(model).__name__ == "ChatGroq"
    assert model.model_name == "llama-3.3-70b-versatile"
