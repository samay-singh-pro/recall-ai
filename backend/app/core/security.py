"""Password hashing. Login tokens will be added to this file later."""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Argon2 with the library's recommended settings. It adds a random "salt" to every hash,
# so the same password gives a different hash each time.
_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Turn a password into the hash that is stored in the database."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if the password matches the stored hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
