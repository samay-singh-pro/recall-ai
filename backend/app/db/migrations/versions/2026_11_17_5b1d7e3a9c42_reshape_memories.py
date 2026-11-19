"""reshape memories: type, title, raw_text and the AI-filled columns

Revision ID: 5b1d7e3a9c42
Revises: 14a5eeab9c00
Create Date: 2026-11-17 15:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5b1d7e3a9c42"
down_revision: str | Sequence[str] | None = "14a5eeab9c00"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AUTO_TITLE_MAX_LENGTH = 60


def upgrade() -> None:
    """Apply this change to the database."""
    # 1. content becomes raw_text (empty is allowed once files can be saved alone);
    # type and title are added with a default so existing rows are valid
    with op.batch_alter_table("memories", schema=None) as batch_op:
        batch_op.alter_column(
            "content", new_column_name="raw_text", existing_type=sa.Text(), nullable=True
        )
        batch_op.add_column(
            sa.Column("type", sa.String(length=20), nullable=False, server_default="text")
        )
        batch_op.add_column(
            sa.Column("title", sa.String(length=200), nullable=False, server_default="Untitled")
        )
        batch_op.add_column(sa.Column("summary", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("link_title", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("link_description", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source_url", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source_memory_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            op.f("fk_memories_source_memory_id_memories"), "memories", ["source_memory_id"], ["id"]
        )

    # 2. Memories saved before titles existed get the start of their text as the title
    op.execute(f"UPDATE memories SET title = substr(raw_text, 1, {AUTO_TITLE_MAX_LENGTH})")

    # 3. Drop the defaults, so new rows must supply a type and a title. A separate step:
    # in the same batch, SQLite would copy the old rows into columns that have no default yet.
    with op.batch_alter_table("memories", schema=None) as batch_op:
        batch_op.alter_column(
            "type", existing_type=sa.String(length=20), existing_nullable=False, server_default=None
        )
        batch_op.alter_column(
            "title",
            existing_type=sa.String(length=200),
            existing_nullable=False,
            server_default=None,
        )


def downgrade() -> None:
    """Undo this change."""
    op.execute("UPDATE memories SET raw_text = '' WHERE raw_text IS NULL")
    with op.batch_alter_table("memories", schema=None) as batch_op:
        batch_op.drop_constraint(op.f("fk_memories_source_memory_id_memories"), type_="foreignkey")
        batch_op.drop_column("source_memory_id")
        batch_op.drop_column("source_url")
        batch_op.drop_column("link_description")
        batch_op.drop_column("link_title")
        batch_op.drop_column("summary")
        batch_op.drop_column("title")
        batch_op.drop_column("type")
        batch_op.alter_column(
            "raw_text", new_column_name="content", existing_type=sa.Text(), nullable=False
        )
