"""Rebuild the search index from the database.

Run it from backend/ after changing EMBEDDING_MODEL, or whenever search results look wrong:
    .venv/bin/python -m scripts.reindex
Restart the API server afterwards, because it keeps the old index open.
"""

import asyncio

from app.core.config import get_settings
from app.db.session import create_engine, create_session_factory
from app.modules.auth.models import User  # noqa: F401
from app.modules.memories.dependencies import get_memory_service, get_vector_store

# User must be imported even though it is unused here: a memory's user_id points at the users
# table, and without it SQLAlchemy returns the id as text without hyphens, so search finds nothing.


async def reindex() -> int:
    """Re-add every memory's text to a fresh index and return how many were added."""
    settings = get_settings()
    engine = create_engine(settings.database_url)
    try:
        async with create_session_factory(engine)() as session:
            service = get_memory_service(session, settings, get_vector_store())
            return await service.reindex_all_memories()
    finally:
        await engine.dispose()


def main() -> None:
    """Run the re-index and say how it went."""
    indexed_count = asyncio.run(reindex())
    print(f"Re-indexed {indexed_count} memories. Restart the API server to use the new index.")


if __name__ == "__main__":
    main()
