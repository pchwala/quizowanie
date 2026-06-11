import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, field_validator


class StartSessionRequest(BaseModel):
    category_ids: list[uuid.UUID] | None = None
    mode: Literal["new", "review", "mixed"] = "mixed"


class StudySessionResponse(BaseModel):
    id: uuid.UUID
    category_ids: list[uuid.UUID] | None
    mode: str
    started_at: datetime
    questions_answered: int

    model_config = {"from_attributes": True}


class SubmitAnswerRequest(BaseModel):
    question_id: uuid.UUID
    quality: int

    @field_validator("quality")
    @classmethod
    def quality_must_be_valid(cls, v: int) -> int:
        if v not in (0, 3, 5):
            raise ValueError("quality must be 0, 3, or 5")
        return v


class SubmitAnswerResponse(BaseModel):
    correct_answer: str
    explanation: str | None
    mnemonic: str | None


class SyncAnswerEvent(BaseModel):
    """One offline answer, identified by a client-generated UUID."""

    event_id: uuid.UUID
    question_id: uuid.UUID
    quality: int
    answered_at: datetime
    mode: Literal["new", "review", "mixed"] = "mixed"

    @field_validator("quality")
    @classmethod
    def quality_must_be_valid(cls, v: int) -> int:
        if v not in (0, 3, 5):
            raise ValueError("quality must be 0, 3, or 5")
        return v


class SyncRequest(BaseModel):
    events: list[SyncAnswerEvent]


class ProgressRow(BaseModel):
    question_id: uuid.UUID
    repetitions: int
    easiness_factor: float
    interval_days: int
    next_review_at: date | None
    last_reviewed_at: datetime | None
    last_quality: int | None

    model_config = {"from_attributes": True}


class SyncResponse(BaseModel):
    synced: int
    progress: list[ProgressRow]
