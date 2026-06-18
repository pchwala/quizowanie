"""add user-submitted questions

Adds the ``user_submission`` source value, ``submitted_by`` (FK users) and
``is_public`` columns on ``questions``, and seeds the shared
"Pytania użytkowników" category that public submissions are filed under.

Revision ID: b8c7d6e5f4a3
Revises: a7b6c5d4e3f2
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c7d6e5f4a3"
down_revision: Union[str, None] = "a7b6c5d4e3f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Fixed id so server and client resolve the same category across databases.
USER_QUESTIONS_CATEGORY_ID = "aaaaaaaa-0000-0000-0000-000000000001"


def upgrade() -> None:
    # Extend the source enum (PG 12+ allows ADD VALUE in a txn; mirrors b2f1a7c4d3e9).
    op.execute("ALTER TYPE questionsource ADD VALUE IF NOT EXISTS 'user_submission'")

    op.add_column("questions", sa.Column("submitted_by", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_questions_submitted_by_users",
        "questions",
        "users",
        ["submitted_by"],
        ["id"],
    )

    # server_default true backfills existing rows; dropped so the ORM owns the default.
    op.add_column(
        "questions",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("questions", "is_public", server_default=None)

    # Shared category for public user submissions.
    op.execute(
        sa.text(
            "INSERT INTO categories (id, name, slug, parent_id) "
            "VALUES (:id, :name, :slug, NULL) ON CONFLICT (slug) DO NOTHING"
        ).bindparams(
            sa.bindparam("id", USER_QUESTIONS_CATEGORY_ID, type_=sa.Uuid()),
            sa.bindparam("name", "Pytania użytkowników"),
            sa.bindparam("slug", "pytania-uzytkownikow"),
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("DELETE FROM categories WHERE id = :id").bindparams(
            sa.bindparam("id", USER_QUESTIONS_CATEGORY_ID, type_=sa.Uuid())
        )
    )
    op.drop_constraint("fk_questions_submitted_by_users", "questions", type_="foreignkey")
    op.drop_column("questions", "is_public")
    op.drop_column("questions", "submitted_by")
    # Note: Postgres cannot remove an enum value, so 'user_submission' remains on
    # questionsource after downgrade. Harmless and avoids a type rebuild.
