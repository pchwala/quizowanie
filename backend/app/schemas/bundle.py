import uuid
from typing import Any

from pydantic import BaseModel

from app.models.question import QuestionSource, QuestionType
from app.schemas.category import CategoryResponse


class BundleQuestion(BaseModel):
    """Full question row for the offline store — includes answer + payload.

    The client builds options locally (see frontend ``local/options.ts``),
    so no pre-shuffled ``options`` field is needed here.
    """

    id: uuid.UUID
    type: QuestionType
    text: str
    answer: str
    payload: dict[str, Any]
    explanation: str | None
    mnemonic: str | None
    source: QuestionSource
    difficulty: int | None
    category_id: uuid.UUID

    model_config = {"from_attributes": True}


class BundleResponse(BaseModel):
    version: str
    question_count: int
    questions: list[BundleQuestion]
    categories: list[CategoryResponse]
    # Questions removed/rejected since ever — client deletes these locally.
    deleted_ids: list[uuid.UUID]
