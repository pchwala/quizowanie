from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.stats import UserStatsResponse
from app.services.stats import get_user_stats

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/stats", response_model=UserStatsResponse)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> object:
    return await get_user_stats(db, current_user.id)
