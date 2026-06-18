import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, field_validator


class SyncAnswerEvent(BaseModel):
    """One answer, identified by a client-generated UUID."""

    event_id: uuid.UUID
    question_id: uuid.UUID
    quality: int
    answered_at: datetime
    mode: Literal["new", "review", "mixed"] = "mixed"

    @field_validator("quality")
    @classmethod
    def quality_must_be_valid(cls, v: int) -> int:
        if v not in (0, 3, 5):
            raise ValueError("quality must be 0, 3, or 5")
        return v


class ProgressRow(BaseModel):
    """Per-question SRS state, computed by the client (the server stores it verbatim)."""

    question_id: uuid.UUID
    repetitions: int
    easiness_factor: float
    interval_days: int
    next_review_at: date | None
    last_reviewed_at: datetime | None
    last_quality: int | None

    model_config = {"from_attributes": True}


class AuthoredQuestionPush(BaseModel):
    """A question authored on the client, pushed to the user's account.

    Immutable once submitted: the server inserts new ids and ignores ids it has
    already stored (no edit/delete in scope).
    """

    id: uuid.UUID
    type: str
    text: str
    answer: str
    payload: dict[str, Any]
    explanation: str | None = None
    mnemonic: str | None = None
    is_public: bool
    category_id: uuid.UUID


class AuthoredQuestion(BaseModel):
    """An authored question returned to the device (restore + status display)."""

    id: uuid.UUID
    type: str
    text: str
    answer: str
    payload: dict[str, Any]
    explanation: str | None
    mnemonic: str | None
    source: str
    category_id: uuid.UUID
    is_public: bool
    verification_status: str

    model_config = {"from_attributes": True}


class SyncRequest(BaseModel):
    # Unsynced answer events from this device.
    events: list[SyncAnswerEvent]
    # The client's ENTIRE local progress table (LWW-merged server-side).
    progress: list[ProgressRow]
    # Questions authored on this device that have not been pushed yet.
    authored_questions: list[AuthoredQuestionPush] = []
    # None means "never set locally" (fresh device) — server copy is kept.
    preferences: dict[str, Any] | None = None
    # Highest server_seq this device has already pulled (0 on a fresh device).
    cursor: int = 0


class SyncResponse(BaseModel):
    synced: int
    # Events this device has not seen yet (server_seq > request cursor).
    events: list[SyncAnswerEvent]
    # ALL server progress rows for the user — client applies LWW per question.
    progress: list[ProgressRow]
    # ALL questions authored by the user (restores authored content on a new device).
    authored_questions: list[AuthoredQuestion]
    preferences: dict[str, Any]
    cursor: int
