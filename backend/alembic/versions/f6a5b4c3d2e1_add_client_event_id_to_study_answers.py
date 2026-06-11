"""add client_event_id to study_answers

Revision ID: f6a5b4c3d2e1
Revises: e5f4a3b2c1d0
Create Date: 2026-06-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "f6a5b4c3d2e1"
down_revision: Union[str, None] = "e5f4a3b2c1d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "study_answers",
        sa.Column("client_event_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_study_answers_client_event_id", "study_answers", ["client_event_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_study_answers_client_event_id", "study_answers")
    op.drop_column("study_answers", "client_event_id")
