"""add mode and category_ids to study_sessions

Revision ID: e5f4a3b2c1d0
Revises: d4e3f2a1b0c7
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID


revision: str = "e5f4a3b2c1d0"
down_revision: Union[str, None] = "d4e3f2a1b0c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("category_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
    )
    op.add_column(
        "study_sessions",
        sa.Column("mode", sa.String(10), nullable=False, server_default="mixed"),
    )
    op.execute(
        "UPDATE study_sessions SET category_ids = ARRAY[category_id] WHERE category_id IS NOT NULL"
    )
    op.drop_column("study_sessions", "category_id")


def downgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("categories.id"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE study_sessions SET category_id = category_ids[1] WHERE category_ids IS NOT NULL"
    )
    op.drop_column("study_sessions", "mode")
    op.drop_column("study_sessions", "category_ids")
