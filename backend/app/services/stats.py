import uuid
from datetime import date, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.progress import UserQuestionProgress
from app.models.question import Question, VerificationStatus
from app.models.session import StudyAnswer, StudySession
from app.schemas.stats import UserStatsResponse, WeakCategory

_WEAK_CATEGORY_MIN_ANSWERS = 5
_WEAK_CATEGORY_LIMIT = 5


async def _due_today(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(UserQuestionProgress).where(
            UserQuestionProgress.user_id == user_id,
            UserQuestionProgress.next_review_at <= date.today(),
        )
    )
    return result.scalar_one()


async def _total_studied(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(UserQuestionProgress).where(
            UserQuestionProgress.user_id == user_id,
        )
    )
    return result.scalar_one()


async def _total_questions(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(Question).where(
            Question.is_active.is_(True),
            Question.verification_status == VerificationStatus.verified,
        )
    )
    return result.scalar_one()


async def _streak_days(db: AsyncSession, user_id: uuid.UUID) -> int:
    rows = (await db.execute(
        select(func.date(StudyAnswer.answered_at).label("study_date"))
        .join(StudySession, StudyAnswer.session_id == StudySession.id)
        .where(StudySession.user_id == user_id)
        .distinct()
        .order_by(text("study_date DESC"))
    )).scalars().all()

    if not rows:
        return 0

    study_dates = set(rows)
    today = date.today()
    # Streak is still alive if user studied today or yesterday
    cursor = today if today in study_dates else today - timedelta(days=1)
    if cursor not in study_dates:
        return 0

    streak = 0
    while cursor in study_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


async def _weak_categories(db: AsyncSession, user_id: uuid.UUID) -> list[WeakCategory]:
    rows = (await db.execute(
        select(
            Question.category_id,
            Category.name,
            func.avg(StudyAnswer.quality).label("avg_quality"),
        )
        .join(StudySession, StudyAnswer.session_id == StudySession.id)
        .join(Question, StudyAnswer.question_id == Question.id)
        .join(Category, Question.category_id == Category.id)
        .where(StudySession.user_id == user_id)
        .group_by(Question.category_id, Category.name)
        .having(func.count() >= _WEAK_CATEGORY_MIN_ANSWERS)
        .order_by(text("avg_quality ASC"))
        .limit(_WEAK_CATEGORY_LIMIT)
    )).all()

    return [
        WeakCategory(category_id=row.category_id, category_name=row.name, avg_quality=round(row.avg_quality, 2))
        for row in rows
    ]


async def get_user_stats(db: AsyncSession, user_id: uuid.UUID) -> UserStatsResponse:
    # These all share one AsyncSession, so they can't run concurrently
    # (asyncio.gather would raise "session is provisioning a new connection").
    due = await _due_today(db, user_id)
    studied = await _total_studied(db, user_id)
    total = await _total_questions(db)
    streak = await _streak_days(db, user_id)
    weak = await _weak_categories(db, user_id)
    return UserStatsResponse(
        due_today=due,
        total_studied=studied,
        total_questions=total,
        streak_days=streak,
        weak_categories=weak,
    )
