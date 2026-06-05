from app.models.progress import UserQuestionProgress


def apply_sm2(progress: UserQuestionProgress, quality: int) -> UserQuestionProgress:
    # TODO: implement SM-2 algorithm
    # quality 0-2 → wrong, reset repetitions to 0, interval = 1
    # quality 3-5 → correct, advance interval and update easiness_factor
    # next_review_at = date.today() + timedelta(days=interval)
    raise NotImplementedError
