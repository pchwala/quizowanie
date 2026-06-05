import uuid

from pydantic import BaseModel

from app.models.question import QuestionSource


class QuestionResponse(BaseModel):
    id: uuid.UUID
    text: str
    source: QuestionSource
    difficulty: int | None
    category_id: uuid.UUID

    model_config = {"from_attributes": True}


class QuestionDetailResponse(QuestionResponse):
    """Full question including answer — only returned after an answer is submitted."""
    answer: str
    explanation: str | None
    mnemonic: str | None
