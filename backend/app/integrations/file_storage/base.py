"""What the app needs from any place that keeps uploaded files."""

from typing import Protocol


class FileStorage(Protocol):
    """Keeps files by path. Local folder today, Supabase Storage later: same three calls."""

    async def save(self, path: str, data: bytes) -> None:
        """Store these bytes under this path, replacing anything already there."""
        ...

    async def read(self, path: str) -> bytes:
        """Return the bytes stored under this path. Raises FileNotFoundError if there are none."""
        ...

    async def delete(self, path: str) -> None:
        """Remove the file at this path; nothing happens if it is already gone."""
        ...
