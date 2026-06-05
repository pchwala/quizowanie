import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.question import QuestionResponse, QuestionDetailResponse

router = APIRouter(tags=["questions"])


@router.get("/questions", response_model=list[QuestionResponse])
async def list_questions(
    category_id: uuid.UUID | None = Query(default=None),
    source: str | None = Query(default=None),
    difficulty_min: int | None = Query(default=None, ge=1, le=10),
    difficulty_max: int | None = Query(default=None, ge=1, le=10),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list:
    # TODO: filtered, paginated query — never returns answer field
    raise NotImplementedError


@router.get("/questions/{question_id}", response_model=QuestionDetailResponse)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> object:
    # TODO: fetch single question including answer
    raise NotImplementedError
