"""Export the questions table back into the seed JSON format.

The output is directly loadable by ``app.seeds.load_questions`` — payloads are
reverse-mapped to ``correct_answer``/``incorrect_answers``/``accepted_answers``,
difficulty 2/5/8 → easy/medium/hard, and category strings are rebuilt as
``"Parent: Child"``.

NOTE: explanation/mnemonic/is_active are NOT part of the seed format — the
script aborts if any row would lose data through the round-trip. Question IDs
are regenerated on reseed (clients must re-download the bundle).

Usage:
    PYTHONPATH=. .venv/bin/python scripts/export_questions.py [--out PATH]
"""
import argparse
import asyncio
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Category, Question
from app.models.question import QuestionType

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = _REPO_ROOT / "data" / f"questions_backup_{date.today().isoformat()}.json"

DIFFICULTY_REVERSE = {2: "easy", 5: "medium", 8: "hard"}


def _to_record(q: Question, category_str: str) -> dict:
    if q.type == QuestionType.multiple:
        correct = q.payload["correct"]
        incorrect = q.payload["incorrect"]
        accepted: list[str] = []
    elif q.type == QuestionType.boolean:
        correct = "True" if q.payload["correct"] else "False"
        incorrect = []
        accepted = []
    else:  # open question
        correct = q.answer
        incorrect = []
        accepted = q.payload.get("accepted", [q.answer])

    return {
        "type": q.type.value,
        "question": q.text,
        "correct_answer": correct,
        "incorrect_answers": incorrect,
        "accepted_answers": accepted,
        "category": category_str,
        "difficulty": DIFFICULTY_REVERSE.get(q.difficulty),
        "source": q.source.value,
        "verification_status": q.verification_status.value,
    }


async def main(out: Path) -> None:
    async with AsyncSessionLocal() as db:
        categories = (await db.execute(select(Category))).scalars().all()
        by_id = {c.id: c for c in categories}

        def category_str(cat_id) -> str:
            c = by_id[cat_id]
            if c.parent_id is not None:
                return f"{by_id[c.parent_id].name}: {c.name}"
            return c.name

        questions = (await db.execute(select(Question).order_by(Question.id))).scalars().all()

        # Refuse a lossy backup — these fields don't exist in the seed format.
        lossy = [
            q.id for q in questions
            if q.explanation or q.mnemonic or not q.is_active
            or (q.difficulty is not None and q.difficulty not in DIFFICULTY_REVERSE)
        ]
        if lossy:
            raise SystemExit(
                f"ABORT: {len(lossy)} rows carry data the seed format cannot hold "
                f"(explanation/mnemonic/is_active=false/odd difficulty), e.g. {lossy[:3]}"
            )

        records = [_to_record(q, category_str(q.category_id)) for q in questions]

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Exported {len(records)} questions ({len(categories)} categories) → {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export questions table to seed JSON.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    asyncio.run(main(parser.parse_args().out))
