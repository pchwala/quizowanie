"""add question type + payload, opentdb source

Adds the ``type`` discriminator (question | multiple | boolean) and a JSONB
``payload`` holding the type-specific answer data, plus the ``opentdb`` value
on the existing ``questionsource`` enum.

Revision ID: b2f1a7c4d3e9
Revises: 897c2a87c2cd
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b2f1a7c4d3e9"
down_revision: Union[str, None] = "897c2a87c2cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


questiontype = postgresql.ENUM(
    "question", "multiple", "boolean", name="questiontype"
)


def upgrade() -> None:
    # Extend the existing source enum with the OpenTDB provenance value.
    op.execute("ALTER TYPE questionsource ADD VALUE IF NOT EXISTS 'opentdb'")

    questiontype.create(op.get_bind(), checkfirst=True)

    # server_default backfills any existing rows; dropped right after so the
    # ORM stays the source of truth for new inserts.
    op.add_column(
        "questions",
        sa.Column(
            "type",
            questiontype,
            nullable=False,
            server_default="question",
        ),
    )
    op.add_column(
        "questions",
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.alter_column("questions", "type", server_default=None)
    op.alter_column("questions", "payload", server_default=None)


def downgrade() -> None:
    op.drop_column("questions", "payload")
    op.drop_column("questions", "type")
    questiontype.drop(op.get_bind(), checkfirst=True)
    # Note: Postgres cannot remove an enum value, so 'opentdb' remains on
    # questionsource after downgrade. Harmless and avoids a type rebuild.
