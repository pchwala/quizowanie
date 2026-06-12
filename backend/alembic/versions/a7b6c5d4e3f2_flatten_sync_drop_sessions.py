"""Flatten sync: study_answers becomes a per-user event log, drop study_sessions.

The backend no longer runs the study engine — the client pushes its events and
computed SRS progress, the server stores them (mirror semantics). Sessions only
existed for the old live endpoints and the stats joins, both removed.

- study_answers.user_id      NEW (backfilled from study_sessions)
- study_answers.mode         NEW (legacy rows get 'mixed')
- study_answers.server_seq   NEW identity column — monotonic pull cursor
- study_answers.client_event_id  now NOT NULL (legacy rows backfilled with PK)
- study_answers.session_id   DROPPED
- study_sessions             DROPPED

Revision ID: a7b6c5d4e3f2
Revises: f6a5b4c3d2e1
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "a7b6c5d4e3f2"
down_revision = "f6a5b4c3d2e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. user_id: add nullable, backfill from the owning session, then constrain.
    op.add_column("study_answers", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.execute(
        """UPDATE study_answers sa SET user_id = ss.user_id
           FROM study_sessions ss WHERE sa.session_id = ss.id"""
    )
    op.execute("DELETE FROM study_answers WHERE user_id IS NULL")  # safety; none expected
    op.alter_column("study_answers", "user_id", nullable=False)
    op.create_foreign_key(
        "study_answers_user_id_fkey", "study_answers", "users", ["user_id"], ["id"]
    )

    # 2. Legacy live-endpoint rows have no client event UUID — reuse the server PK.
    op.execute("UPDATE study_answers SET client_event_id = id WHERE client_event_id IS NULL")
    op.alter_column("study_answers", "client_event_id", nullable=False)

    # 3. mode mirrors the local answer_events.mode column.
    op.add_column(
        "study_answers",
        sa.Column("mode", sa.String(10), nullable=False, server_default="mixed"),
    )

    # 4. Monotonic pull cursor (Postgres backfills identity values for existing rows).
    op.add_column(
        "study_answers",
        sa.Column("server_seq", sa.BigInteger(), sa.Identity(), nullable=False),
    )
    op.create_index("ix_study_answers_user_seq", "study_answers", ["user_id", "server_seq"])

    # 5. Drop the session machinery.
    op.drop_constraint("study_answers_session_id_fkey", "study_answers", type_="foreignkey")
    op.drop_column("study_answers", "session_id")
    op.drop_table("study_sessions")


def downgrade() -> None:
    raise NotImplementedError(
        "Destructive cleanup of a disposable test DB — restore from a seed instead."
    )
