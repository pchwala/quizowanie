"""add verification_status to questions

Revision ID: c3d2e1f0a9b8
Revises: b2f1a7c4d3e9
Create Date: 2026-06-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c3d2e1f0a9b8"
down_revision: Union[str, None] = "b2f1a7c4d3e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


verificationstatus = postgresql.ENUM(
    "pending", "verified", "rejected", name="verificationstatus"
)


def upgrade() -> None:
    verificationstatus.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "questions",
        sa.Column(
            "verification_status",
            verificationstatus,
            nullable=False,
            server_default="pending",
        ),
    )
    op.alter_column("questions", "verification_status", server_default=None)


def downgrade() -> None:
    op.drop_column("questions", "verification_status")
    verificationstatus.drop(op.get_bind(), checkfirst=True)
