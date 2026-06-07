"""
Compile all pipeline outputs into a single final_questions.json ready for DB loading.

Sources (must exist in data/):
  pytania.json           — Polish-translated questions (4738, position-indexed)
  triage.json            — AI triage scores + buckets (4738, same order)
  review_decisions.json  — Human decisions for the triage "review" band

Inclusion rules (applied in order):
  triage bucket="drop"             → excluded (AI judged irrelevant)
  triage bucket="approve"          → included, verification_status=verified
  triage bucket="review":
    review decision="approve"      → included, verification_status=verified
      question_pl set              → use edited Polish text
    review decision="drop"         → excluded
    review decision="skip"         → included, verification_status=pending

Output: data/final_questions.json — one object per question:
  {
    "type":                "multiple" | "boolean" | "question",
    "difficulty":          "easy" | "medium" | "hard",
    "category":            "Kategoria Nadrzędna: Podkategoria",
    "question":            "<Polish question text>",
    "correct_answer":      "<string>",      # "True"/"False" for boolean
    "incorrect_answers":   ["...", ...],    # empty for boolean/question
    "accepted_answers":    ["...", ...],    # only for type=question
    "verification_status": "verified" | "pending",
    "source":              "opentdb"
  }

Usage:
  python -m app.seeds.compile_questions
  python -m app.seeds.compile_questions --pytania data/pytania.json ...
"""

import argparse
import json
from collections import Counter
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"

DEFAULT_PYTANIA = _DATA_DIR / "pytania.json"
DEFAULT_TRIAGE = _DATA_DIR / "triage.json"
DEFAULT_DECISIONS = _DATA_DIR / "review_decisions.json"
DEFAULT_OUTPUT = _DATA_DIR / "final_questions.json"


def compile_questions(
    pytania: Path,
    triage: Path,
    decisions: Path,
    output: Path,
) -> None:
    pl_questions: list[dict] = json.loads(pytania.read_text(encoding="utf-8"))
    triage_entries: list[dict] = json.loads(triage.read_text(encoding="utf-8"))
    review_decisions: list[dict] = json.loads(decisions.read_text(encoding="utf-8"))

    if len(pl_questions) != len(triage_entries):
        raise SystemExit(
            f"Length mismatch: {len(pl_questions)} pytania vs {len(triage_entries)} triage entries.\n"
            "Re-run triage to realign."
        )

    # Index review decisions by question index for O(1) lookup
    decisions_by_index: dict[int, dict] = {d["index"]: d for d in review_decisions}

    final: list[dict] = []
    counts: Counter = Counter()
    edits = 0

    for idx, (pl, tr) in enumerate(zip(pl_questions, triage_entries)):
        bucket = tr["bucket"]

        if bucket == "drop":
            counts["excluded_triage_drop"] += 1
            continue

        if bucket == "approve":
            verification_status = "verified"
            question_text = pl["question"]

        else:  # bucket == "review"
            dec = decisions_by_index.get(idx)
            if dec is None:
                # Question was in review band but has no decision — treat as pending
                verification_status = "pending"
                question_text = pl["question"]
                counts["warning_no_decision"] += 1
            elif dec["decision"] == "drop":
                counts["excluded_review_drop"] += 1
                continue
            elif dec["decision"] == "skip":
                verification_status = "pending"
                question_text = pl["question"]
            else:  # approve
                verification_status = "verified"
                question_text = dec["question_pl"] or pl["question"]
                if dec["question_pl"]:
                    edits += 1

        entry: dict = {
            "type": pl["type"],
            "difficulty": pl["difficulty"],
            "category": pl["category"],
            "question": question_text,
            "correct_answer": pl["correct_answer"],
            "incorrect_answers": pl.get("incorrect_answers", []),
            "verification_status": verification_status,
            "source": "opentdb",
        }
        if pl.get("accepted_answers"):
            entry["accepted_answers"] = pl["accepted_answers"]

        final.append(entry)
        counts["included"] += 1
        counts[f"included_{verification_status}"] += 1

    output.write_text(json.dumps(final, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Compiled {len(pl_questions)} source questions → {len(final)} in final output.")
    print(f"  Included:                {counts['included']}")
    print(f"    verified:              {counts.get('included_verified', 0)}")
    print(f"    pending:               {counts.get('included_pending', 0)}")
    print(f"  Excluded (triage drop):  {counts.get('excluded_triage_drop', 0)}")
    print(f"  Excluded (review drop):  {counts.get('excluded_review_drop', 0)}")
    if edits:
        print(f"  Human-edited questions: {edits}")
    if counts.get("warning_no_decision"):
        print(f"  WARNING: {counts['warning_no_decision']} review-band items had no decision (set to pending)")
    print(f"\nWrote {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile pipeline outputs into final_questions.json.")
    parser.add_argument("--pytania", type=Path, default=DEFAULT_PYTANIA)
    parser.add_argument("--triage", type=Path, default=DEFAULT_TRIAGE)
    parser.add_argument("--decisions", type=Path, default=DEFAULT_DECISIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    for p, name in [(args.pytania, "pytania"), (args.triage, "triage"), (args.decisions, "decisions")]:
        if not p.exists():
            raise SystemExit(f"Missing input: {p}  (run the {name} step first)")

    compile_questions(args.pytania, args.triage, args.decisions, args.output)


if __name__ == "__main__":
    main()
