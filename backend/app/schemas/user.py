import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class UserPreferences(BaseModel):
    show_options: bool = True
    daily_limit: int = 15


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime
    preferences: UserPreferences = UserPreferences()

    model_config = {"from_attributes": True}

    @field_validator("preferences", mode="before")
    @classmethod
    def parse_preferences(cls, v: Any) -> Any:
        if v is None:
            return {}
        return v
