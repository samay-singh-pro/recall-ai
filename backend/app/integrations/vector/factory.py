"""Builds the vector store named in the settings."""

from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStore

from app.core.config import Settings

# The way of measuring closeness is fixed when a collection is created, and the search cut-off
# only makes sense with this one (cosine). The name says so, so an older collection is never reused.
COLLECTION_NAME = "memories-cosine"


def reset_vector_store(store: VectorStore) -> None:
    """Delete everything in the store and leave it empty, with the same cosine setting."""
    if not isinstance(store, Chroma):
        raise TypeError(f"Cannot reset a {type(store).__name__}")
    store.reset_collection()


def create_vector_store(settings: Settings, embeddings: Embeddings) -> VectorStore:
    """Build the store chosen by VECTOR_STORE; only the local Chroma folder exists so far."""
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=settings.chroma_dir,
        collection_configuration={"hnsw": {"space": "cosine"}},
    )
