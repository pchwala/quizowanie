from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(tags=["auth"])


@router.post("/auth/me", response_model=UserResponse)
async def get_or_create_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
