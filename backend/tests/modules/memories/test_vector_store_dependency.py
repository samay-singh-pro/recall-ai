from concurrent.futures import ThreadPoolExecutor

from app.modules.memories.dependencies import get_vector_store


def test_several_requests_can_open_the_vector_store_at_the_same_moment() -> None:
    def open_store(_: int) -> str:
        get_vector_store()
        return "opened"

    # Without the lock, Chroma fails for every one of these when they start together.
    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(open_store, range(6)))

    assert results == ["opened"] * 6
