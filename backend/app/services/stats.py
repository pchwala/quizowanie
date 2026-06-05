import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.stats import UserStatsResponse


async def get_user_stats(db: AsyncSession, user_id: uuid.UUID) -> UserStatsResponse:
    # TODO: compute due_today, total_studied, streak_days, total_questions, weak_categories
    raise NotImplementedError
