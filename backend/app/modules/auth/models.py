"""Database table for the people who can log in."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# The longest email address the internet standard allows.
EMAIL_MAX_LENGTH = 320
NAME_MAX_LENGTH = 50


class User(Base):
    """One account. Inherits id, created_at and updated_at from Base."""

    __tablename__ = "users"

    # What the app calls the user. Not unique: the email is what identifies an account.
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    # `unique=True` makes the database itself refuse a second account with the same email.
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), unique=True)
    # Only the scrambled fingerprint of the password is stored, never the password.
    password_hash: Mapped[str] = mapped_column(String(255))
