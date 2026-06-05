"""
AI triage (LLM-as-judge) for the translated question set.

Reads the Polish ``data/pytania.json`` together with the English source
``data/all_questions.json`` (aligned by position) and asks the model to score
each question on two axes plus flags:

  - relevance (0-2): is the question worthwhile for a *general Polish* audience?
  - quality   (0-2): is the Polish translation correct and natural?

Each result is routed into a bucket:
  - ``approve`` — relevance 2 and quality 2 (spot-check only, no full review)
  - ``drop``    — relevance 0 (irrelevant for a Polish audience)
  - ``review``  — everything else -> the human queue

Outputs:
  - ``data/triage.json``        — full scores for every question
  - ``data/review_queue.json``  — only the ``review`` band, with EN+PL side by
                                  side, scores, flags and notes, for the human tool

Resumable via ``data/triage.checkpoint.jsonl`` (keyed by index), exactly like
the translator. ``--assemble-only`` rebuilds the outputs without API calls.

Usage:
    export OPENAI_API_KEY=sk-...
    python -m app.seeds.triage_questions --limit 20      # smoke test
    python -m app.seeds.triage_questions                 # full run (resumable)
    python -m app.seeds.triage_questions --assemble-only # rebuild outputs

Requires: openai
"""

import argparse
import asyncio
import json
from collections import Counter
from pathlib import Path
from typing import Any

# Reuse helpers from the translator (HTML cleanup + tolerant checkpoint reader).
from app.seeds.translate_questions import _clean, _iter_checkpoint

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"

DEFAULT_POLISH = _DATA_DIR / "pytania.json"
DEFAULT_SOURCE = _DATA_DIR / "all_questions.json"
DEFAULT_OUTPUT = _DATA_DIR / "triage.json"
DEFAULT_REVIEW = _DATA_DIR / "review_queue.json"
DEFAULT_CHECKPOINT = _DATA_DIR / "triage.checkpoint.jsonl"
DEFAULT_MODEL = "gpt-4.1-mini"

FLAGS = [
    "leftover_english",      # untranslated English left in the Polish text
    "mistranslation",        # a key term (species, place, etc.) translated wrong
    "awkward_phrasing",      # understandable but unnatural Polish
    "grammar",               # grammatical errors
    "us_centric",            # only meaningful to a US/English audience
    "untranslatable_wordplay",  # relies on English wording that doesn't survive
    "niche",                 # very obscure for a general audience
    "factual_doubt",         # the stated answer looks factually wrong
    "ambiguous",             # question/answer is unclear
]

SYSTEM_PROMPT = (
    "You are a strict quality reviewer for a Polish-language trivia quiz app. "
    "For each item you receive the original English question and its Polish "
    "translation (with the Polish answers). Score two axes from 0 to 2 and "
    "assign flags.\n\n"
    "relevance — is this question worthwhile for a GENERAL POLISH audience?\n"
    "  2 = universally relevant, or relevant to Poland\n"
    "  1 = niche but acceptable\n"
    "  0 = irrelevant or unanswerable for a Polish audience (e.g. US-state "
    "trivia, American-football minutiae, US-only TV), or it depends on English "
    "wordplay that does not survive translation\n\n"
    "quality — is the Polish translation correct and natural?\n"
    "  2 = correct, fluent, natural Polish; the correct answer stays correct\n"
    "  1 = understandable but awkward, minor errors, or a clumsy left-in "
    "foreign name\n"
    "  0 = broken: leftover untranslated English, a mistranslated key term "
    "(wrong species/place/etc.), grammatical errors, or incoherent text\n\n"
    "flags — include every flag that applies (may be empty).\n"
    "note — one short sentence (in Polish) naming the main problem, or an empty "
    "string if there is none.\n\n"
    "Be strict on quality. Keep 'index' unchanged and return one result per item."
)

RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "triage",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "index": {"type": "integer"},
                            "relevance": {"type": "integer", "enum": [0, 1, 2]},
                            "quality": {"type": "integer", "enum": [0, 1, 2]},
                            "flags": {
                                "type": "array",
                                "items": {"type": "string", "enum": FLAGS},
                            },
                            "note": {"type": "string"},
                        },
                        "required": ["index", "relevance", "quality", "flags", "note"],
                    },
                }
            },
            "required": ["items"],
        },
    },
}


def _bucket(relevance: int, quality: int) -> str:
    if relevance == 0:
        return "drop"
    if relevance == 2 and quality == 2:
        return "approve"
    return "review"


def _load_aligned(polish: Path, source: Path, limit: int) -> list[dict[str, Any]]:
    """Pair Polish records with their English source by position.

    pytania.json is assembled in source order, so position == source index.
    A length mismatch means the translation is incomplete (or rows were
    dropped); we refuse rather than risk misaligning EN/PL.
    """
    pl = json.loads(polish.read_text(encoding="utf-8"))
    en = json.loads(source.read_text(encoding="utf-8"))
    if len(pl) != len(en):
        raise SystemExit(
            f"Length mismatch: {len(pl)} Polish vs {len(en)} English records.\n"
            "Re-run translation to fill any gaps so the two files stay aligned, "
            "then retry triage."
        )
    items: list[dict[str, Any]] = []
    rows = list(zip(en, pl))
    if limit:
        rows = rows[:limit]
    for idx, (e, p) in enumerate(rows):
        items.append(
            {
                "index": idx,
                "category": _clean(e.get("category", "")),
                "question_en": _clean(e["question"]),
                "question_pl": p["question"],
                "answers_pl": _answers_pl(p),
                "polish_record": p,
                "english_record": e,
            }
        )
    return items


def _answers_pl(rec: dict[str, Any]) -> list[str]:
    qtype = rec.get("type")
    if qtype == "multiple":
        return [rec.get("correct_answer", ""), *rec.get("incorrect_answers", [])]
    if qtype == "question":
        return list(rec.get("accepted_answers", []))
    return []  # boolean: answers are True/False, not informative for the judge


async def _judge_batch(
    client: Any, model: str, batch: list[dict[str, Any]], max_retries: int = 4
) -> dict[int, dict[str, Any]]:
    """Judge one batch; returns {index: {"relevance","quality","flags","note"}}."""
    payload = [
        {
            "index": b["index"],
            "category": b["category"],
            "question_en": b["question_en"],
            "question_pl": b["question_pl"],
            "answers_pl": b["answers_pl"],
        }
        for b in batch
    ]
    wanted = {b["index"] for b in batch}

    last_err: Exception | None = None
    for attempt in range(max_retries):
        try:
            resp = await client.chat.completions.create(
                model=model,
                temperature=0,
                response_format=RESPONSE_FORMAT,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            )
            data = json.loads(resp.choices[0].message.content)
            result: dict[int, dict[str, Any]] = {}
            for item in data.get("items", []):
                idx = item.get("index")
                if idx in wanted:
                    result[idx] = {
                        "relevance": item["relevance"],
                        "quality": item["quality"],
                        "flags": item["flags"],
                        "note": item["note"],
                    }
            return result
        except Exception as err:  # noqa: BLE001 - retry any transient API/JSON error
            last_err = err
            await asyncio.sleep(2 ** attempt)
    print(f"  ! batch failed after {max_retries} retries: {last_err}")
    return {}


def _assemble(checkpoint: Path, items_by_index: dict[int, dict[str, Any]],
              output: Path, review_out: Path) -> dict[str, int]:
    """Build triage.json + review_queue.json from the checkpoint; print summary."""
    scored: dict[int, dict[str, Any]] = {}
    for row in _iter_checkpoint(checkpoint):
        scored[row["index"]] = row["score"]

    full: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    buckets: Counter = Counter()
    flag_counts: Counter = Counter()

    for idx in sorted(scored):
        score = scored[idx]
        bucket = _bucket(score["relevance"], score["quality"])
        buckets[bucket] += 1
        flag_counts.update(score["flags"])
        src = items_by_index.get(idx, {})
        entry = {
            "index": idx,
            "bucket": bucket,
            "relevance": score["relevance"],
            "quality": score["quality"],
            "flags": score["flags"],
            "note": score["note"],
            "category": src.get("category"),
        }
        full.append(entry)
        if bucket == "review":
            review.append(
                {
                    **entry,
                    "question_en": src.get("question_en"),
                    "question_pl": src.get("question_pl"),
                    "answers_pl": src.get("answers_pl"),
                }
            )

    output.write_text(json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
    review_out.write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nScored {len(full)} questions:")
    for b in ("approve", "review", "drop"):
        print(f"  {b:8s}: {buckets.get(b, 0)}")
    print("Top flags:")
    for flag, n in flag_counts.most_common():
        print(f"  {n:5d}  {flag}")
    print(f"\nWrote {output} and {review_out} ({len(review)} to review).")
    return dict(buckets)


async def run(args: argparse.Namespace) -> None:
    items = _load_aligned(args.polish, args.source, args.limit)
    items_by_index = {it["index"]: it for it in items}
    print(f"Loaded {len(items)} aligned EN/PL questions.")

    if not args.assemble_only:
        done = {row["index"] for row in _iter_checkpoint(args.checkpoint)}
        if done:
            print(f"Resuming: {len(done)} already judged, skipping them.")
        todo = [it for it in items if it["index"] not in done]

        if todo:
            from openai import AsyncOpenAI  # lazy import; --assemble-only needs no key

            client = AsyncOpenAI()
            batches = [todo[i : i + args.batch_size] for i in range(0, len(todo), args.batch_size)]
            sem = asyncio.Semaphore(args.concurrency)
            ckpt_lock = asyncio.Lock()
            progress = 0
            total = len(todo)

            async def worker(batch: list[dict[str, Any]]) -> None:
                nonlocal progress
                async with sem:
                    scores = await _judge_batch(client, args.model, batch)
                lines = [
                    json.dumps({"index": it["index"], "score": scores[it["index"]]}, ensure_ascii=False)
                    for it in batch
                    if it["index"] in scores
                ]
                if lines:
                    async with ckpt_lock:
                        with args.checkpoint.open("a", encoding="utf-8") as fh:
                            fh.write("\n".join(lines) + "\n")
                        progress += len(lines)
                        print(f"  progress: {progress}/{total} judged")

            await asyncio.gather(*(worker(b) for b in batches))
        else:
            print("Nothing to judge.")

    buckets = _assemble(args.checkpoint, items_by_index, args.output, args.review)
    missing = len(items) - sum(buckets.values())
    if missing:
        print(f"  ⚠ {missing} question(s) not judged — re-run to retry them.")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI triage for translated questions.")
    parser.add_argument("--polish", type=Path, default=DEFAULT_POLISH)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--batch-size", type=int, default=15)
    parser.add_argument("--concurrency", type=int, default=6)
    parser.add_argument("--limit", type=int, default=0, help="Judge only the first N (smoke test).")
    parser.add_argument("--assemble-only", action="store_true", help="Rebuild outputs from checkpoint; no API calls.")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
