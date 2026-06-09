import uuid
from typing import Any

from pydantic import BaseModel

from app.models.question import QuestionSource, QuestionType


class QuestionResponse(BaseModel):
    """Question as served *before* answering — never reveals the correct answer.

    ``options`` carries the choices the client must render for non-open types
    (shuffled choices for ``multiple``, the two labels for ``boolean``); it is
    ``None`` for open ``question`` types. The router populates it from the
    payload without leaking which option is correct.
    """

    id: uuid.UUID
    type: QuestionType
    text: str
    source: QuestionSource
    difficulty: int | None
    category_id: uuid.UUID
    options: list[str] | None = None

    model_config = {"from_attributes": True}


class QuestionDetailResponse(QuestionResponse):
    """Full question including answer — only returned after an answer is submitted."""
    answer: str
    payload: dict[str, Any]
    explanation: str | None
    mnemonic: str | None


class BrowseQuestionsPage(BaseModel):
    items: list[QuestionDetailResponse]
    total: int
