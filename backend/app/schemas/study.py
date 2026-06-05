import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class StartSessionRequest(BaseModel):
    category_id: uuid.UUID | None = None


class StudySessionResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID | None
    started_at: datetime
    questions_answered: int

    model_config = {"from_attributes": True}


class SubmitAnswerRequest(BaseModel):
    question_id: uuid.UUID
    quality: int

    @field_validator("quality")
    @classmethod
    def quality_must_be_valid(cls, v: int) -> int:
        if v not in (0, 3, 4, 5):
            raise ValueError("quality must be 0, 3, 4, or 5")
        return v


class SubmitAnswerResponse(BaseModel):
    correct_answer: str
    explanation: str | None
    mnemonic: str | None
