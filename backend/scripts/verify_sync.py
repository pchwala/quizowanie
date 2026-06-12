"""One-shot verification of POST /sync + GET /bundles/latest against the dev DB.

Bypasses Firebase by overriding get_current_user with a synthetic user.
Creates → exercises → cleans up its own rows. Run:

    PYTHONPATH=. .venv/bin/python scripts/verify_sync.py

Asserts the mirror protocol: idempotent event union, verbatim progress storage
with a per-question LWW guard, preferences round-trip, and the full-restore
pull a fresh device performs (cursor=0, empty push).
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.dependencies import get_current_user
from app.main import app
from app.models.answer import StudyAnswer
from app.models.progress import UserQuestionProgress
from app.models.question import Question
from app.models.user import User

TEST_UID = f"verify-sync-{uuid.uuid4().hex[:8]}"
PREFS = {"show_options": True, "daily_limit": 15}


def _progress_row(question_id: uuid.UUID, quality: int, reviewed_at: datetime) -> dict:
    """A plausible client-computed SRS row — the server must store it verbatim."""
    good = quality > 0
    return {
        "question_id": str(question_id),
        "repetitions": 1 if good else 0,
        "easiness_factor": 2.5 if good else 2.3,
        "interval_days": 1,
        "next_review_at": (reviewed_at + timedelta(days=1)).date().isoformat(),
        "last_reviewed_at": reviewed_at.isoformat(),
        "last_quality": quality,
    }


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
    progress = [
        _progress_row(qid, q, t0 + timedelta(minutes=i))
        for i, (qid, q) in enumerate(zip(question_ids, [3, 0]))
    ]
    batch = {"events": events, "progress": progress, "preferences": PREFS, "cursor": 0}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Public bundle endpoint
        r = await client.get("/bundles/latest")
        assert r.status_code == 200, r.text
        bundle = r.json()
        print(f"bundles/latest OK — version={bundle['version']}, "
              f"questions={bundle['question_count']}, categories={len(bundle['categories'])}")

        # 2. First push: events unioned, progress stored verbatim, prefs echoed
        r1 = await client.post("/sync", json=batch)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["synced"] == 2, d1
        stored = {p["question_id"]: p for p in d1["progress"]}
        for sent in progress:
            got = stored[sent["question_id"]]
            for key, want in sent.items():
                have = got[key]
                if key == "last_reviewed_at":
                    have = datetime.fromisoformat(have)
                    want = datetime.fromisoformat(want)
                assert have == want, f"{key}: stored {have!r} != pushed {want!r}"
        assert d1["preferences"] == PREFS, d1["preferences"]
        assert d1["cursor"] > 0
        assert d1["events"] == [], "own batch must not echo back"
        cursor = d1["cursor"]
        print(f"first sync OK — synced=2, progress stored verbatim, prefs echoed, cursor={cursor}")

        # 3. Identical re-push: idempotent no-op
        r2 = await client.post("/sync", json={**batch, "cursor": cursor})
        d2 = r2.json()
        assert d2["synced"] == 0, d2
        assert {p["question_id"]: p for p in d2["progress"]} == stored, \
            "progress changed on duplicate batch"
        print("duplicate sync OK — synced=0, progress unchanged")

        # 4. Fresh-device pull (cursor=0, nothing local): the full-restore guarantee
        r3 = await client.post("/sync", json={
            "events": [], "progress": [], "preferences": None, "cursor": 0,
        })
        d3 = r3.json()
        pulled_ids = {e["event_id"] for e in d3["events"]}
        assert pulled_ids == {e["event_id"] for e in events}, d3["events"]
        assert {p["question_id"]: p for p in d3["progress"]} == stored
        assert d3["preferences"] == PREFS
        assert d3["cursor"] == cursor
        print(f"fresh-device pull OK — {len(d3['events'])} events + progress + prefs restored")

        # 5. Stale push: older last_reviewed_at must not regress the server row
        stale = _progress_row(question_ids[0], 0, t0 - timedelta(days=2))
        r4 = await client.post("/sync", json={
            "events": [], "progress": [stale], "preferences": None, "cursor": cursor,
        })
        d4 = r4.json()
        assert {p["question_id"]: p for p in d4["progress"]} == stored, \
            "stale progress overwrote a newer server row"
        print("stale push OK — LWW guard held")

    # Exactly one study_answers row per event
    async with AsyncSessionLocal() as db:
        answers = (await db.execute(
            select(StudyAnswer).where(StudyAnswer.user_id == user.id)
        )).scalars().all()
        assert len(answers) == 2, f"expected 2 answer rows, got {len(answers)}"
        print("DB state OK — 1 row per event")

        # Cleanup
        await db.execute(delete(StudyAnswer).where(StudyAnswer.user_id == user.id))
        await db.execute(delete(UserQuestionProgress).where(UserQuestionProgress.user_id == user.id))
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()
        print("cleanup OK")


if __name__ == "__main__":
    asyncio.run(main())
