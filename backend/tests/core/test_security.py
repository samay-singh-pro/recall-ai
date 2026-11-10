from app.core.security import hash_password, verify_password


def test_hash_does_not_contain_the_password() -> None:
    password_hash = hash_password("correct horse")

    assert "correct horse" not in password_hash


def test_the_right_password_verifies() -> None:
    password_hash = hash_password("correct horse")

    assert verify_password("correct horse", password_hash) is True


def test_a_wrong_password_does_not_verify() -> None:
    password_hash = hash_password("correct horse")

    assert verify_password("wrong horse", password_hash) is False


def test_the_same_password_gives_a_different_hash_each_time() -> None:
    first = hash_password("correct horse")
    second = hash_password("correct horse")

    assert first != second
    assert verify_password("correct horse", first)
    assert verify_password("correct horse", second)
