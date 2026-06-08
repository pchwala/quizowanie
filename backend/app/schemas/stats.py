import uuid

from pydantic import BaseModel


class WeakCategory(BaseModel):
    category_id: uuid.UUID
    category_name: str
    avg_quality: float


class UserStatsResponse(BaseModel):
    due_today: int
    total_studied: int
    streak_days: int
    total_questions: int
    weak_categories: list[WeakCategory]
