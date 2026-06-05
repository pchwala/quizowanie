import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuestionSource(str, enum.Enum):
    archive_1z10 = "1z10_archive"
    milionerzy_archive = "milionerzy_archive"
    pubquiz_archive = "pubquiz_archive"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    text: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    mnemonic: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[QuestionSource] = mapped_column(SAEnum(QuestionSource))
    difficulty: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
