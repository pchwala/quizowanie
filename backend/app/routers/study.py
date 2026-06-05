import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.study import (
    StartSessionRequest,
    StudySessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.schemas.question import QuestionResponse

router = APIRouter(prefix="/study", tags=["study"])


@router.post("/sessions", response_model=StudySessionResponse, status_code=201)
async def start_session(
    body: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> object:
    # TODO: create StudySession row, return it
    raise NotImplementedError


@router.get("/sessions/{session_id}/next", response_model=QuestionResponse)
async def get_next_question(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> object:
    # TODO: due SRS questions first, then unseen; 404 when session is exhausted
    raise NotImplementedError


@router.post("/sessions/{session_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    session_id: uuid.UUID,
    body: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> object:
    # TODO: apply SM-2, log StudyAnswer, increment questions_answered, return answer + explanation
    raise NotImplementedError


@router.post("/sessions/{session_id}/end", status_code=204)
async def end_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    # TODO: set ended_at on StudySession
    raise NotImplementedError
