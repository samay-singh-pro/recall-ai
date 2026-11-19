from pydantic import SecretStr

from app.core.config import Settings
from app.integrations.llm.embeddings_factory import create_embeddings


def test_builds_the_embedding_model_from_the_settings():
    settings = Settings(
        embedding_model="gemini-embedding-001", gemini_api_key=SecretStr("placeholder")
    )

    embeddings = create_embeddings(settings)

    assert type(embeddings).__name__ == "GoogleGenerativeAIEmbeddings"
    assert embeddings.model.endswith("gemini-embedding-001")
