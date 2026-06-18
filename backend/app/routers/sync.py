import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.answer import StudyAnswer
from app.models.progress import UserQuestionProgress
from app.models.question import Question, QuestionSource, QuestionType, VerificationStatus
from app.models.user import User
from app.schemas.sync import (
    AuthoredQuestion,
    ProgressRow,
    SyncAnswerEvent,
    SyncRequest,
    SyncResponse,
)

router = APIRouter(tags=["sync"])


def _as_utc(dt: datetime | None) -> datetime | None:
    """Treat naive client timestamps as UTC so LWW comparisons never raise."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@router.post("/sync", response_model=SyncResponse)
async def sync(
    body: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncResponse:
    """Mirror the device's user data and return what it is missing.

    The client is the study engine; the server stores. Push: answer events are
    unioned idempotently by ``client_event_id``; SRS progress rows are upserted
    per question with a last-write-wins guard on ``last_reviewed_at``;
    preferences are replaced when the client has any. Pull: events with
    ``server_seq > cursor`` (so a fresh device rebuilds full history and local
    stats), all progress rows, and preferences.

    Known race (accepted): two concurrent syncs for the same user can commit
    identity values out of order, so a cursor advanced by one device could skip
    an event committed later with a lower ``server_seq``. Negligible for
    passive-trigger, single-user multi-device sync.

    NOTE: a single AsyncSession is not safe for concurrent use — await all
    queries sequentially, never asyncio.gather (see routers/bundles.py).
    """
    pushed_ids = {e.event_id for e in body.events}

    # ---- Push: events (union by client_event_id) -------------------------
    existing_ids: set[uuid.UUID] = set()
    if pushed_ids:
        existing_ids = set((await db.execute(
            select(StudyAnswer.client_event_id).where(
                StudyAnswer.client_event_id.in_(pushed_ids)
            )
        )).scalars().all())

    seen: set[uuid.UUID] = set(existing_ids)
    new_events: list[SyncAnswerEvent] = []
    for e in body.events:
        if e.event_id in seen:
            continue
        seen.add(e.event_id)
        new_events.append(e)

    referenced_qids = {e.question_id for e in new_events} | {
        p.question_id for p in body.progress
    }
    known_qids: set[uuid.UUID] = set()
    active_qids: set[uuid.UUID] = set()
    if referenced_qids:
        rows = (await db.execute(
            select(Question.id, Question.is_active).where(Question.id.in_(referenced_qids))
        )).all()
        known_qids = {qid for qid, _ in rows}
        active_qids = {qid for qid, active in rows if active}

    synced = 0
    for e in new_events:
        if e.question_id not in active_qids:
            continue
        db.add(StudyAnswer(
            user_id=current_user.id,
            question_id=e.question_id,
            quality=e.quality,
            answered_at=_as_utc(e.answered_at),
            mode=e.mode,
            client_event_id=e.event_id,
        ))
        synced += 1

    # ---- Push: progress (LWW per question by last_reviewed_at) -----------
    # Defensive in-batch dedupe (the table is unique per question client-side,
    # but ON CONFLICT cannot touch the same row twice in one statement).
    best: dict[uuid.UUID, ProgressRow] = {}
    for p in body.progress:
        if p.last_reviewed_at is None or p.question_id not in known_qids:
            continue
        prev = best.get(p.question_id)
        if prev is None or _as_utc(p.last_reviewed_at) > _as_utc(prev.last_reviewed_at):
            best[p.question_id] = p

    if best:
        stmt = pg_insert(UserQuestionProgress).values([
            {
                "id": uuid.uuid4(),
                "user_id": current_user.id,
                "question_id": p.question_id,
                "repetitions": p.repetitions,
                "easiness_factor": p.easiness_factor,
                "interval_days": p.interval_days,
                "next_review_at": p.next_review_at,
                "last_reviewed_at": _as_utc(p.last_reviewed_at),
                "last_quality": p.last_quality,
            }
            for p in best.values()
        ])
        stmt = stmt.on_conflict_do_update(
            index_elements=["user_id", "question_id"],
            set_={
                "repetitions": stmt.excluded.repetitions,
                "easiness_factor": stmt.excluded.easiness_factor,
                "interval_days": stmt.excluded.interval_days,
                "next_review_at": stmt.excluded.next_review_at,
                "last_reviewed_at": stmt.excluded.last_reviewed_at,
                "last_quality": stmt.excluded.last_quality,
            },
            where=(
                UserQuestionProgress.last_reviewed_at.is_(None)
                | (stmt.excluded.last_reviewed_at > UserQuestionProgress.last_reviewed_at)
            ),
        )
        await db.execute(stmt)

    # ---- Push: authored questions (insert-only, immutable by id) ----------
    if body.authored_questions:
        pushed_qids = {q.id for q in body.authored_questions}
        existing_qids = set((await db.execute(
            select(Question.id).where(Question.id.in_(pushed_qids))
        )).scalars().all())
        added: set[uuid.UUID] = set()
        for q in body.authored_questions:
            if q.id in existing_qids or q.id in added:
                continue
            added.add(q.id)
            db.add(Question(
                id=q.id,
                type=QuestionType(q.type),
                text=q.text,
                answer=q.answer,
                payload=q.payload,
                explanation=q.explanation,
                mnemonic=q.mnemonic,
                source=QuestionSource.user_submission,
                verification_status=VerificationStatus.pending,
                difficulty=None,
                category_id=q.category_id,
                is_active=True,
                submitted_by=current_user.id,
                is_public=q.is_public,
            ))

    # ---- Push: preferences (client copy authoritative when present) ------
    if body.preferences is not None:
        current_user.preferences = body.preferences

    await db.commit()

    # ---- Pull: events the device is missing, all progress, preferences ---
    pull_stmt = (
        select(StudyAnswer)
        .where(StudyAnswer.user_id == current_user.id, StudyAnswer.server_seq > body.cursor)
        .order_by(StudyAnswer.server_seq)
    )
    if pushed_ids:
        pull_stmt = pull_stmt.where(StudyAnswer.client_event_id.not_in(pushed_ids))
    missing = (await db.execute(pull_stmt)).scalars().all()

    progress_rows = (await db.execute(
        select(UserQuestionProgress).where(UserQuestionProgress.user_id == current_user.id)
    )).scalars().all()

    authored = (await db.execute(
        select(Question).where(Question.submitted_by == current_user.id).order_by(Question.created_at)
    )).scalars().all()

    max_seq = (await db.execute(
        select(func.max(StudyAnswer.server_seq)).where(StudyAnswer.user_id == current_user.id)
    )).scalar()

    return SyncResponse(
        synced=synced,
        events=[
            SyncAnswerEvent(
                event_id=a.client_event_id,
                question_id=a.question_id,
                quality=a.quality,
                answered_at=a.answered_at,
                mode=a.mode,
            )
            for a in missing
        ],
        progress=[ProgressRow.model_validate(r) for r in progress_rows],
        authored_questions=[AuthoredQuestion.model_validate(q) for q in authored],
        preferences=current_user.preferences,
        cursor=max_seq if max_seq is not None else body.cursor,
    )
