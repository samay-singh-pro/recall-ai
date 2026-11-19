from pathlib import Path

from langchain_core.embeddings import DeterministicFakeEmbedding

from app.core.config import Settings
from app.integrations.vector.factory import create_vector_store


def test_stores_text_and_finds_the_closest_match(tmp_path: Path):
    # A fake embedding model gives the same numbers for the same text, so no Gemini call is made.
    store = create_vector_store(
        Settings(chroma_dir=str(tmp_path)), DeterministicFakeEmbedding(size=16)
    )
    store.add_texts(["Vet appointment Friday 5pm", "Mom phone 98765"])

    found = store.similarity_search("Mom phone 98765", k=1)

    assert [document.page_content for document in found] == ["Mom phone 98765"]


def test_keeps_the_text_in_the_folder_between_runs(tmp_path: Path):
    settings = Settings(chroma_dir=str(tmp_path))
    embeddings = DeterministicFakeEmbedding(size=16)
    create_vector_store(settings, embeddings).add_texts(["Gym at 7"])

    reopened = create_vector_store(settings, embeddings)

    assert reopened.similarity_search("Gym at 7", k=1)[0].page_content == "Gym at 7"
