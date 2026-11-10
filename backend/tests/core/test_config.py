import pytest

from app.core.config import Settings


def test_settings_read_supabase_values_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "secret-value")
    monkeypatch.setenv("MAX_FILE_SIZE_MB", "3")

    settings = Settings(_env_file=None)

    assert settings.supabase_url == "https://example.supabase.co"
    assert settings.supabase_secret_key.get_secret_value() == "secret-value"
    assert settings.max_file_size_mb == 3


def test_secret_key_is_hidden_when_settings_are_printed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "secret-value")

    settings = Settings(_env_file=None)

    assert "secret-value" not in repr(settings)
    assert "secret-value" not in str(settings.model_dump())


def test_the_placeholder_jwt_secret_is_refused_outside_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "change-me")

    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(_env_file=None)


def test_a_real_jwt_secret_is_accepted_outside_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "a-long-random-value")

    settings = Settings(_env_file=None)

    assert settings.jwt_secret.get_secret_value() == "a-long-random-value"
