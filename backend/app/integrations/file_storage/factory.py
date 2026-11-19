"""Picks the file storage named in the settings."""

from pathlib import Path

from app.core.config import Settings
from app.integrations.file_storage.base import FileStorage
from app.integrations.file_storage.local import LocalFileStorage


def create_file_storage(settings: Settings) -> FileStorage:
    """Build the storage chosen by FILE_STORAGE; only the local folder exists so far."""
    return LocalFileStorage(Path(settings.local_storage_dir))
