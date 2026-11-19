"""File storage on this machine's disk, for development and tests."""

import asyncio
from pathlib import Path


class LocalFileStorage:
    """Keeps files in a folder on disk."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    async def save(self, path: str, data: bytes) -> None:
        """Write the file, creating folders as needed."""
        full_path = self._full_path(path)
        await asyncio.to_thread(_write, full_path, data)

    async def read(self, path: str) -> bytes:
        """Read the file. Raises FileNotFoundError if it is missing."""
        return await asyncio.to_thread(self._full_path(path).read_bytes)

    async def delete(self, path: str) -> None:
        """Delete the file if it exists."""
        await asyncio.to_thread(self._full_path(path).unlink, missing_ok=True)

    def _full_path(self, path: str) -> Path:
        """Join the path to the storage folder, refusing anything that climbs out of it."""
        full_path = (self._root / path).resolve()
        if not full_path.is_relative_to(self._root):
            raise ValueError("The path points outside the storage folder")
        return full_path


def _write(full_path: Path, data: bytes) -> None:
    """Blocking disk write, run in a thread so it does not freeze the server."""
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(data)
