import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StudyAnswer(Base):
    """One answer event — the server-side mirror of the local ``answer_events`` table.

    Append-only; idempotent ingestion is keyed by the client-generated
    ``client_event_id``. ``server_seq`` is the monotonic cursor devices use to
    pull events they have not seen yet.
    """

    __tablename__ = "study_answers"
    __table_args__ = (Index("ix_study_answers_user_seq", "user_id", "server_seq"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"))
    quality: Mapped[int] = mapped_column(SmallInteger)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    mode: Mapped[str] = mapped_column(String(10), default="mixed", server_default="mixed")
    client_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True)
    server_seq: Mapped[int] = mapped_column(BigInteger, Identity(), nullable=False)
