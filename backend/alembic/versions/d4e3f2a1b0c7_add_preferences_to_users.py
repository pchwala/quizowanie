"""add preferences to users

Revision ID: d4e3f2a1b0c7
Revises: c3d2e1f0a9b8
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "d4e3f2a1b0c7"
down_revision: Union[str, None] = "c3d2e1f0a9b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferences", JSONB, nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences")
