"""One-shot verification of POST /study/sync + GET /bundles/latest against the dev DB.

Bypasses Firebase by overriding get_current_user with a synthetic user.
Creates → exercises → cleans up its own rows. Run:

    .venv/bin/python scripts/verify_sync.py
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.dependencies import get_current_user
from app.main import app
from app.models.progress import UserQuestionProgress
from app.models.question import Question
from app.models.session import StudyAnswer, StudySession
from app.models.user import User

TEST_UID = f"verify-sync-{uuid.uuid4().hex[:8]}"


async def main() -> None:
    async with AsyncSessionLocal() as db:
        user = User(firebase_uid=TEST_UID, email="verify@test.local")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        question_ids = (await db.execute(
            select(Question.id).where(Question.is_active.is_(True)).limit(2)
        )).scalars().all()
    assert len(question_ids) == 2, "need at least 2 questions in DB"

    app.dependency_overrides[get_current_user] = lambda: user

    t0 = datetime.now(timezone.utc) - timedelta(hours=1)
    events = [
        {
            "event_id": str(uuid.uuid4()),
            "question_id": str(qid),
            "quality": q,
            "answered_at": (t0 + timedelta(minutes=i)).isoformat(),
            "mode": "new",
        }
        for i, (qid, q) in enumerate(zip(question_ids, [3, 0]))
    ]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Public bundle endpoint
        r = await client.get("/bundles/latest")
        assert r.status_code == 200, r.text
        bundle = r.json()
        print(f"bundles/latest OK — version={bundle['version']}, "
              f"questions={bundle['question_count']}, categories={len(bundle['categories'])}")

        # First sync: both events ingested
        r1 = await client.post("/study/sync", json={"events": events})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["synced"] == 2, d1
        progress_after_first = {p["question_id"]: p for p in d1["progress"]}
        assert len(progress_after_first) == 2
        print(f"first sync OK — synced={d1['synced']}, progress rows={len(d1['progress'])}")

        # Second sync, same batch: idempotent no-op
        r2 = await client.post("/study/sync", json={"events": events})
        d2 = r2.json()
        assert d2["synced"] == 0, d2
        assert {p["question_id"]: p for p in d2["progress"]} == progress_after_first, \
            "progress changed on duplicate batch"
        print(f"duplicate sync OK — synced={d2['synced']}, progress unchanged")

    # Exactly one study_answers row per event, SM-2 state as expected
    async with AsyncSessionLocal() as db:
        sessions = (await db.execute(
            select(StudySession.id).where(StudySession.user_id == user.id)
        )).scalars().all()
        answers = (await db.execute(
            select(StudyAnswer).where(StudyAnswer.session_id.in_(sessions))
        )).scalars().all()
        assert len(answers) == 2, f"expected 2 answer rows, got {len(answers)}"
        prog = (await db.execute(
            select(UserQuestionProgress).where(UserQuestionProgress.user_id == user.id)
        )).scalars().all()
        by_q = {p.question_id: p for p in prog}
        good = by_q[question_ids[0]]
        wrong = by_q[question_ids[1]]
        assert (good.repetitions, good.interval_days, good.easiness_factor) == (1, 1, 2.5)
        assert (wrong.repetitions, wrong.interval_days, wrong.easiness_factor) == (0, 1, 2.3)
        print("DB state OK — 1 row per event; SM-2: good=(rep 1, ef 2.5), wrong=(rep 0, ef 2.3)")

        # Cleanup
        await db.execute(delete(StudyAnswer).where(StudyAnswer.session_id.in_(sessions)))
        await db.execute(delete(StudySession).where(StudySession.user_id == user.id))
        await db.execute(delete(UserQuestionProgress).where(UserQuestionProgress.user_id == user.id))
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()
        print("cleanup OK")


if __name__ == "__main__":
    asyncio.run(main())
