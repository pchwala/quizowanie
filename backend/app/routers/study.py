import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.category import Category
from app.models.progress import UserQuestionProgress
from app.models.question import Question, VerificationStatus
from app.models.session import StudyAnswer, StudySession
from app.models.user import User
from app.routers.questions import _to_response
from app.schemas.study import (
    StartSessionRequest,
    StudySessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.schemas.question import QuestionResponse
from app.services.srs import apply_sm2, make_progress

router = APIRouter(prefix="/study", tags=["study"])


async def _get_session(session_id: uuid.UUID, user: User, db: AsyncSession) -> StudySession:
    session = (await db.execute(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.user_id == user.id,
        )
    )).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesja nie znaleziona")
    return session


@router.post("/sessions", response_model=StudySessionResponse, status_code=201)
async def start_session(
    body: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    if body.category_id is not None:
        exists = (await db.execute(
            select(Category.id).where(Category.id == body.category_id)
        )).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategoria nie znaleziona")

    session = StudySession(user_id=current_user.id, category_id=body.category_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions/{session_id}/next", response_model=QuestionResponse)
async def get_next_question(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    session = await _get_session(session_id, current_user, db)

    def _base_filter(stmt):
        stmt = stmt.where(Question.is_active.is_(True), Question.verification_status == VerificationStatus.verified)
        if session.category_id is not None:
            stmt = stmt.where(Question.category_id == session.category_id)
        return stmt

    # Stage 1: due SRS questions
    due_stmt = _base_filter(
        select(Question)
        .join(UserQuestionProgress, (
            (UserQuestionProgress.question_id == Question.id) &
            (UserQuestionProgress.user_id == current_user.id)
        ))
        .where(UserQuestionProgress.next_review_at <= date.today())
        .order_by(UserQuestionProgress.next_review_at.asc())
    )
    question = (await db.execute(due_stmt)).scalars().first()

    # Stage 2: unseen questions
    if question is None:
        seen_ids = select(UserQuestionProgress.question_id).where(
            UserQuestionProgress.user_id == current_user.id
        )
        unseen_stmt = _base_filter(
            select(Question)
            .where(Question.id.not_in(seen_ids))
            .order_by(Question.id)
        )
        question = (await db.execute(unseen_stmt)).scalars().first()

    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak pytań do nauki")

    return _to_response(question)


@router.post("/sessions/{session_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    session_id: uuid.UUID,
    body: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmitAnswerResponse:
    session = await _get_session(session_id, current_user, db)
    if session.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sesja jest już zakończona")

    question = (await db.execute(
        select(Question).where(Question.id == body.question_id, Question.is_active.is_(True))
    )).scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pytanie nie znalezione")

    progress = (await db.execute(
        select(UserQuestionProgress).where(
            UserQuestionProgress.user_id == current_user.id,
            UserQuestionProgress.question_id == question.id,
        )
    )).scalar_one_or_none()
    if progress is None:
        progress = make_progress(current_user.id, question.id)
        db.add(progress)

    apply_sm2(progress, body.quality)

    db.add(StudyAnswer(session_id=session.id, question_id=question.id, quality=body.quality))
    session.questions_answered += 1

    await db.commit()

    return SubmitAnswerResponse(
        correct_answer=question.answer,
        explanation=question.explanation,
        mnemonic=question.mnemonic,
    )


@router.post("/sessions/{session_id}/end", status_code=204)
async def end_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    session = await _get_session(session_id, current_user, db)
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
