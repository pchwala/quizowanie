import uuid
from datetime import datetime, timedelta, timezone

from app.models.progress import UserQuestionProgress


def make_progress(user_id: uuid.UUID, question_id: uuid.UUID) -> UserQuestionProgress:
    return UserQuestionProgress(
        user_id=user_id,
        question_id=question_id,
        repetitions=0,
        easiness_factor=2.5,
        interval_days=0,
    )


WRONG, GOOD, EASY = 0, 3, 5
_EASY_INTERVAL_BONUS = 1.3


def apply_sm2(
    progress: UserQuestionProgress,
    quality: int,
    *,
    reviewed_at: datetime | None = None,
) -> UserQuestionProgress:
    """Apply one SM-2 review.

    ``reviewed_at`` defaults to now; the offline-sync replay passes the
    original answer timestamp so intervals are anchored to when the user
    actually reviewed, not when the batch reached the server.
    """
    reviewed_at = reviewed_at or datetime.now(timezone.utc)
    if quality == WRONG:
        progress.repetitions = 0
        interval = 1
        progress.easiness_factor = max(1.3, progress.easiness_factor - 0.2)
    else:
        if progress.repetitions == 0:
            interval = 1
        elif progress.repetitions == 1:
            interval = 6
        else:
            interval = round(progress.interval_days * progress.easiness_factor)
        progress.repetitions += 1
        if quality == EASY:
            interval = round(interval * _EASY_INTERVAL_BONUS)
            progress.easiness_factor = progress.easiness_factor + 0.15
        # GOOD: easiness factor unchanged (neutral pass)

    progress.interval_days = interval
    progress.next_review_at = reviewed_at.date() + timedelta(days=interval)
    progress.last_reviewed_at = reviewed_at
    progress.last_quality = quality
    return progress
