"""add name to users

Revision ID: 9c26f45f3a42
Revises: ee41cb287f99
Create Date: 2026-11-11 16:32:49.405605
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9c26f45f3a42"
down_revision: str | Sequence[str] | None = "ee41cb287f99"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply this change to the database."""
    # 1. Accounts made before names existed become "Guest"
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("name", sa.String(length=50), nullable=False, server_default="Guest")
        )

    # 2. Drop that default, so every new account must supply a real name. A separate step:
    # in the same batch, SQLite would copy the old rows into a table that has no default yet.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("name", server_default=None)


def downgrade() -> None:
    """Undo this change."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("name")
