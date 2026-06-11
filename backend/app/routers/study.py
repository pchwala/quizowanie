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
    ProgressRow,
    StartSessionRequest,
    StudySessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SyncRequest,
    SyncResponse,
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
    if body.category_ids:
        found = (await db.execute(
            select(Category.id).where(Category.id.in_(body.category_ids))
        )).scalars().all()
        if len(found) != len(set(body.category_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategoria nie znaleziona")

    session = StudySession(
        user_id=current_user.id,
        category_ids=body.category_ids or None,
        mode=body.mode,
    )
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
        if session.category_ids:
            stmt = stmt.where(Question.category_id.in_(session.category_ids))
        return stmt

    question = None

    # Stage 1: due SRS questions
    if session.mode in ("review", "mixed"):
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
    if question is None and session.mode in ("new", "mixed"):
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


def _as_utc(dt: datetime) -> datetime:
    """Treat naive client timestamps as UTC so LWW comparisons never raise."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@router.post("/sync", response_model=SyncResponse)
async def sync_answers(
    body: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncResponse:
    """Bulk-ingest offline answer events.

    Idempotent: events are deduped by ``client_event_id`` (union semantics —
    re-posting a batch is a no-op). SM-2 is replayed in ``answered_at`` order,
    but a per-question last-write-wins guard skips events older than the
    progress row's ``last_reviewed_at`` so a stale device cannot regress
    progress made elsewhere.
    """
    events = sorted(body.events, key=lambda e: _as_utc(e.answered_at))

    # Drop events the server has already seen (idempotency).
    incoming_ids = [e.event_id for e in events]
    existing_ids: set[uuid.UUID] = set()
    if incoming_ids:
        existing_ids = set((await db.execute(
            select(StudyAnswer.client_event_id).where(
                StudyAnswer.client_event_id.in_(incoming_ids)
            )
        )).scalars().all())

    seen: set[uuid.UUID] = set(existing_ids)
    new_events = []
    for e in events:
        if e.event_id in seen:
            continue
        seen.add(e.event_id)
        new_events.append(e)

    synced = 0
    if new_events:
        question_ids = {e.question_id for e in new_events}
        valid_ids = set((await db.execute(
            select(Question.id).where(
                Question.id.in_(question_ids), Question.is_active.is_(True)
            )
        )).scalars().all())

        progress_map = {
            p.question_id: p
            for p in (await db.execute(
                select(UserQuestionProgress).where(
                    UserQuestionProgress.user_id == current_user.id,
                    UserQuestionProgress.question_id.in_(question_ids),
                )
            )).scalars().all()
        }

        # One synthetic session per sync batch keeps stats joins unchanged.
        session = StudySession(
            user_id=current_user.id,
            mode="mixed",
            ended_at=datetime.now(timezone.utc),
        )
        db.add(session)
        await db.flush()

        for e in new_events:
            if e.question_id not in valid_ids:
                continue
            answered_at = _as_utc(e.answered_at)

            progress = progress_map.get(e.question_id)
            if progress is None:
                progress = make_progress(current_user.id, e.question_id)
                progress_map[e.question_id] = progress
                db.add(progress)
            # LWW guard: only replay events newer than the current row state.
            if progress.last_reviewed_at is None or answered_at > progress.last_reviewed_at:
                apply_sm2(progress, e.quality, reviewed_at=answered_at)

            db.add(StudyAnswer(
                session_id=session.id,
                question_id=e.question_id,
                quality=e.quality,
                answered_at=answered_at,
                client_event_id=e.event_id,
            ))
            session.questions_answered += 1
            synced += 1

        await db.commit()

    rows = (await db.execute(
        select(UserQuestionProgress).where(
            UserQuestionProgress.user_id == current_user.id
        )
    )).scalars().all()

    return SyncResponse(
        synced=synced,
        progress=[ProgressRow.model_validate(r) for r in rows],
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
