"""
Load final_questions.json into the database.

  - Upserts categories (parent/child split on ': ', slugified)
  - Maps difficulty easy/medium/hard → 2/5/8
  - Builds JSONB payload per question type
  - Skips questions whose text is already in the DB (idempotent re-runs)
  - Inserts in batches of 500

Usage:
  cd backend
  python -m app.seeds.load_questions
  python -m app.seeds.load_questions --file data/final_questions.json
  python -m app.seeds.load_questions --dry-run
"""

import argparse
import asyncio
import json
import re
import unicodedata
import uuid
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Category, Question
from app.models.question import QuestionSource, QuestionType, VerificationStatus

_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_FILE = _REPO_ROOT / "data" / "final_questions.json"

DIFFICULTY_MAP = {"easy": 2, "medium": 5, "hard": 8}
BOOLEAN_DISPLAY = {"True": "Prawda", "False": "Fałsz"}
BATCH_SIZE = 500

_PL_TRANSLIT = str.maketrans(
    "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ",
    "acelnoszzACELNOSZZ",
)


def _slugify(name: str) -> str:
    name = name.translate(_PL_TRANSLIT)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = name.lower()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def _parse_category(raw: str) -> tuple[str, str | None]:
    """Return (child_name, parent_name_or_None)."""
    if ": " in raw:
        parent, child = raw.split(": ", 1)
        return child, parent
    return raw, None


def _build_payload(qtype: str, correct: str, incorrect: list[str], accepted: list[str]) -> dict:
    if qtype == "multiple":
        return {"correct": correct, "incorrect": incorrect}
    if qtype == "boolean":
        return {"correct": correct == "True"}
    # question type
    return {"accepted": accepted or [correct]}


async def _upsert_categories(
    session: AsyncSession,
    category_strings: set[str],
    dry_run: bool,
) -> dict[str, uuid.UUID]:
    """Return {category_string → category_id} for all needed categories."""
    # Load all existing slugs once
    rows = (await session.execute(select(Category))).scalars().all()
    by_slug: dict[str, Category] = {c.slug: c for c in rows}
    cat_map: dict[str, uuid.UUID] = {}

    # Two passes: parents first, then children
    parents_needed: dict[str, str] = {}  # parent_name → parent_slug
    for raw in category_strings:
        _, parent_name = _parse_category(raw)
        if parent_name:
            parents_needed[parent_name] = _slugify(parent_name)

    for parent_name, parent_slug in parents_needed.items():
        if parent_slug not in by_slug:
            cat = Category(id=uuid.uuid4(), name=parent_name, slug=parent_slug, parent_id=None)
            if not dry_run:
                session.add(cat)
            by_slug[parent_slug] = cat
            print(f"  + category: {parent_name!r} (slug={parent_slug})")

    if not dry_run:
        await session.flush()  # parents need IDs before children reference them

    for raw in sorted(category_strings):
        child_name, parent_name = _parse_category(raw)
        if parent_name:
            parent_slug = _slugify(parent_name)
            child_slug = f"{parent_slug}-{_slugify(child_name)}"
            parent_id = by_slug[parent_slug].id
        else:
            child_slug = _slugify(child_name)
            parent_id = None

        if child_slug not in by_slug:
            cat = Category(id=uuid.uuid4(), name=child_name, slug=child_slug, parent_id=parent_id)
            if not dry_run:
                session.add(cat)
            by_slug[child_slug] = cat
            print(f"  + category: {child_name!r} (slug={child_slug})")

    if not dry_run:
        await session.flush()

    for raw in category_strings:
        child_name, parent_name = _parse_category(raw)
        if parent_name:
            slug = f"{_slugify(parent_name)}-{_slugify(child_name)}"
        else:
            slug = _slugify(child_name)
        cat_map[raw] = by_slug[slug].id

    return cat_map


async def load(file: Path, dry_run: bool) -> None:
    records: list[dict] = json.loads(file.read_text(encoding="utf-8"))
    print(f"Loaded {len(records)} questions from {file}.")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Collect existing question texts for dedup
            existing_texts: set[str] = set(
                (await session.execute(select(Question.text))).scalars().all()
            )
            print(f"  {len(existing_texts)} questions already in DB — will skip duplicates.")

            category_strings = {r["category"] for r in records}
            cat_map = await _upsert_categories(session, category_strings, dry_run)

            to_insert: list[Question] = []
            skipped = 0

            for rec in records:
                text_pl = rec["question"]
                if text_pl in existing_texts:
                    skipped += 1
                    continue

                qtype = rec["type"]
                correct = rec["correct_answer"]
                incorrect = rec.get("incorrect_answers", [])
                accepted = rec.get("accepted_answers", [])

                answer = BOOLEAN_DISPLAY.get(correct, correct) if qtype == "boolean" else correct
                payload = _build_payload(qtype, correct, incorrect, accepted)
                difficulty = DIFFICULTY_MAP.get(rec["difficulty"])
                category_id = cat_map[rec["category"]]

                q = Question(
                    id=uuid.uuid4(),
                    type=QuestionType(qtype),
                    text=text_pl,
                    answer=answer,
                    payload=payload,
                    source=QuestionSource(rec["source"]),
                    verification_status=VerificationStatus(rec["verification_status"]),
                    difficulty=difficulty,
                    category_id=category_id,
                    is_active=True,
                )
                to_insert.append(q)
                existing_texts.add(text_pl)  # prevent dupes within this file

            print(f"  {skipped} skipped (already in DB), {len(to_insert)} to insert.")

            if dry_run:
                print("Dry run — no changes written.")
                return

            for i in range(0, len(to_insert), BATCH_SIZE):
                batch = to_insert[i : i + BATCH_SIZE]
                session.add_all(batch)
                await session.flush()
                print(f"  inserted batch {i // BATCH_SIZE + 1}: {len(batch)} questions")

    print(f"Done. {len(to_insert)} questions loaded.")


def main() -> None:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")

    parser = argparse.ArgumentParser(description="Load final_questions.json into the DB.")
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE)
    parser.add_argument("--dry-run", action="store_true", help="Validate + print plan, no DB writes.")
    args = parser.parse_args()

    if not args.file.exists():
        raise SystemExit(f"File not found: {args.file}\nRun compile_questions.py first.")

    asyncio.run(load(args.file, args.dry_run))


if __name__ == "__main__":
    main()
