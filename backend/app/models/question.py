import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuestionSource(str, enum.Enum):
    archive_1z10 = "1z10_archive"
    milionerzy_archive = "milionerzy_archive"
    pubquiz_archive = "pubquiz_archive"
    opentdb = "opentdb"


class QuestionType(str, enum.Enum):
    """How the answer is presented and graded.

    The type-specific answer data lives in ``Question.payload``:
      - ``question`` -> {"accepted": ["...", "..."]}        # any match counts
      - ``multiple`` -> {"correct": "...", "incorrect": ["...", "...", "..."]}
      - ``boolean``  -> {"correct": true}
    """

    question = "question"
    multiple = "multiple"
    boolean = "boolean"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    type: Mapped[QuestionType] = mapped_column(SAEnum(QuestionType))
    text: Mapped[str] = mapped_column(Text)
    # Canonical/display answer (the single correct answer, for review & SRS front).
    answer: Mapped[str] = mapped_column(Text)
    # Type-specific answer structure — see QuestionType docstring.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    mnemonic: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[QuestionSource] = mapped_column(SAEnum(QuestionSource))
    difficulty: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
