import random
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.question import Question, QuestionType, VerificationStatus
from app.models.user import User
from app.schemas.question import QuestionDetailResponse, QuestionResponse

router = APIRouter(tags=["questions"])


def _build_options(qtype: QuestionType, payload: dict) -> list[str] | None:
    """Shuffled choices for multiple/boolean, None for open — never marks which is correct."""
    if qtype == QuestionType.multiple:
        options = [payload["correct"]] + list(payload["incorrect"])
        random.shuffle(options)
        return options
    if qtype == QuestionType.boolean:
        return ["Prawda", "Fałsz"]
    return None


def _to_response(q: Question) -> QuestionResponse:
    return QuestionResponse(
        id=q.id,
        type=q.type,
        text=q.text,
        source=q.source,
        difficulty=q.difficulty,
        category_id=q.category_id,
        options=_build_options(q.type, q.payload),
    )


def _to_detail(q: Question) -> QuestionDetailResponse:
    return QuestionDetailResponse(
        id=q.id,
        type=q.type,
        text=q.text,
        source=q.source,
        difficulty=q.difficulty,
        category_id=q.category_id,
        options=_build_options(q.type, q.payload),
        answer=q.answer,
        payload=q.payload,
        explanation=q.explanation,
        mnemonic=q.mnemonic,
    )


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
) -> list[QuestionResponse]:
    stmt = (
        select(Question)
        .where(
            Question.is_active.is_(True),
            Question.verification_status == VerificationStatus.verified,
        )
        .order_by(Question.created_at)
        .limit(limit)
        .offset(offset)
    )
    if category_id is not None:
        stmt = stmt.where(Question.category_id == category_id)
    if source is not None:
        stmt = stmt.where(Question.source == source)
    if difficulty_min is not None:
        stmt = stmt.where(Question.difficulty >= difficulty_min)
    if difficulty_max is not None:
        stmt = stmt.where(Question.difficulty <= difficulty_max)

    rows = (await db.execute(stmt)).scalars().all()
    return [_to_response(q) for q in rows]


@router.get("/browse/questions", response_model=list[QuestionDetailResponse])
async def browse_questions(
    category_id: uuid.UUID | None = Query(default=None),
    q_type: QuestionType | None = Query(default=None, alias="type"),
    source: str | None = Query(default=None),
    difficulty_min: int | None = Query(default=None, ge=1, le=10),
    difficulty_max: int | None = Query(default=None, ge=1, le=10),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[QuestionDetailResponse]:
    stmt = (
        select(Question)
        .where(
            Question.is_active.is_(True),
            Question.verification_status == VerificationStatus.verified,
        )
        .order_by(Question.created_at)
        .limit(limit)
        .offset(offset)
    )
    if category_id is not None:
        stmt = stmt.where(Question.category_id == category_id)
    if q_type is not None:
        stmt = stmt.where(Question.type == q_type)
    if source is not None:
        stmt = stmt.where(Question.source == source)
    if difficulty_min is not None:
        stmt = stmt.where(Question.difficulty >= difficulty_min)
    if difficulty_max is not None:
        stmt = stmt.where(Question.difficulty <= difficulty_max)

    rows = (await db.execute(stmt)).scalars().all()
    return [_to_detail(q) for q in rows]


@router.get("/questions/{question_id}", response_model=QuestionDetailResponse)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> QuestionDetailResponse:
    q = (await db.execute(
        select(Question).where(Question.id == question_id)
    )).scalar_one_or_none()

    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pytanie nie znalezione")

    return _to_detail(q)
