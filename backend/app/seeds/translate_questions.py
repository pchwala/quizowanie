"""
Translate the English OpenTDB question dataset into Polish with the OpenAI API.

Reads ``data/all_questions.json`` (English) and writes ``data/pytania.json``
(Polish) in the *same* schema, ready for ``load_questions.py``.

What it does per record:
  - HTML-unescapes all text (``&amp;``, ``&#039;``, ``&quot;`` ...).
  - Maps the category to Polish via a static table (consistent, no API cost).
  - Translates the question text and — for ``multiple``/``question`` types —
    the answer strings, instructing the model to keep proper nouns / titles
    unchanged. ``boolean`` answers stay as ``True``/``False`` (the loader maps
    them to a bool; the UI shows Prawda/Fałsz), so only their question text
    is translated.

It is **resumable**: every translated record is appended to a JSONL checkpoint
keyed by its source index. Re-running skips already-done indices; a crash mid
run loses nothing. ``--assemble-only`` rebuilds the final JSON from the
checkpoint without calling the API.

Usage:
    export OPENAI_API_KEY=sk-...
    python -m app.seeds.translate_questions                 # full run
    python -m app.seeds.translate_questions --limit 20      # smoke test
    python -m app.seeds.translate_questions --assemble-only # rebuild output

Requires: openai  (pip install openai)
"""

import argparse
import asyncio
import html
import json
from pathlib import Path
from typing import Any

# backend/app/seeds/translate_questions.py -> repo root is parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"

DEFAULT_INPUT = _DATA_DIR / "all_questions.json"
DEFAULT_OUTPUT = _DATA_DIR / "pytania.json"
DEFAULT_CHECKPOINT = _DATA_DIR / "pytania.checkpoint.jsonl"
DEFAULT_MODEL = "gpt-4.1-mini"


# OpenTDB categories -> Polish. Keys are HTML-unescaped (``&`` not ``&amp;``).
# The ": " separator is preserved so load_questions.py can split parent/child.
CATEGORY_MAP: dict[str, str] = {
    "General Knowledge": "Wiedza ogólna",
    "History": "Historia",
    "Geography": "Geografia",
    "Science & Nature": "Nauka i przyroda",
    "Science: Computers": "Nauka: Komputery",
    "Science: Mathematics": "Nauka: Matematyka",
    "Science: Gadgets": "Nauka: Gadżety",
    "Sports": "Sport",
    "Animals": "Zwierzęta",
    "Vehicles": "Pojazdy",
    "Politics": "Polityka",
    "Mythology": "Mitologia",
    "Celebrities": "Celebryci",
    "Art": "Sztuka",
    "Entertainment: Video Games": "Rozrywka: Gry wideo",
    "Entertainment: Music": "Rozrywka: Muzyka",
    "Entertainment: Film": "Rozrywka: Film",
    "Entertainment: Television": "Rozrywka: Telewizja",
    "Entertainment: Books": "Rozrywka: Książki",
    "Entertainment: Japanese Anime & Manga": "Rozrywka: Anime i manga",
    "Entertainment: Cartoon & Animations": "Rozrywka: Kreskówki i animacje",
    "Entertainment: Board Games": "Rozrywka: Gry planszowe",
    "Entertainment: Comics": "Rozrywka: Komiksy",
    "Entertainment: Musicals & Theatres": "Rozrywka: Musicale i teatr",
}

SYSTEM_PROMPT = (
    "Jesteś profesjonalnym tłumaczem pytań do quizu wiedzowego na język polski. "
    "Tłumacz naturalnie i poprawnie, zachowując sens pytania tak, aby poprawna "
    "odpowiedź pozostała poprawna. Każdy element zawiera pole 'category' — użyj "
    "go jako kontekstu do ujednoznacznienia słów (np. 'Turkey' w kategorii "
    "'Animals' to indyk, a nie Turcja).\n"
    "Zasady:\n"
    "- ZOSTAW w oryginale: tytuły dzieł (gier, filmów, książek, piosenek, "
    "albumów, seriali), nazwy marek, produktów i zespołów oraz nazwy własne, "
    "które nie mają utrwalonego polskiego odpowiednika.\n"
    "- UŻYJ utrwalonej polskiej nazwy (egzonimu), jeśli istnieje: dla nazw "
    "geograficznych (krajów, miast, rzek), postaci historycznych i "
    "mitologicznych, gatunków zwierząt i roślin oraz terminów naukowych "
    "(np. 'Lithuania' → 'Litwa', 'Charlemagne' → 'Karol Wielki', "
    "'common kingfisher' → 'zimorodek zwyczajny').\n"
    "- Tłumacz rzeczowniki pospolite (kształty, kolory, materiały itp.).\n"
    "- Zachowaj liczby, jednostki, symbole i kod bez zmian.\n"
    "- Jeśli nazwa nie ma dobrego polskiego odpowiednika i pozostawienie jej "
    "w oryginale brzmiałoby w pytaniu nienaturalnie, oddaj jej sens opisowo, "
    "zachowując poprawność odpowiedzi.\n"
    "- Nie dodawaj wyjaśnień ani komentarzy.\n"
    "- Pole 'answers' w odpowiedzi MUSI mieć tę samą długość i kolejność co w "
    "danych wejściowych. Pole 'index' musi pozostać niezmienione."
)

# Strict structured-output schema: a uniform {index, question, answers[]} per item.
RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "translations",
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
                            "question": {"type": "string"},
                            "answers": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["index", "question", "answers"],
                    },
                }
            },
            "required": ["items"],
        },
    },
}


def _clean(value: Any) -> Any:
    """HTML-unescape strings (and lists of strings); pass other types through."""
    if isinstance(value, str):
        return html.unescape(value)
    if isinstance(value, list):
        return [_clean(v) for v in value]
    return value


def _translatable_answers(rec: dict[str, Any]) -> list[str]:
    """The answer strings that should be sent to the model for this record.

    multiple -> [correct, *incorrect]; question -> accepted_answers; boolean -> [].
    """
    qtype = rec.get("type")
    if qtype == "multiple":
        return [rec["correct_answer"], *rec.get("incorrect_answers", [])]
    if qtype == "question":
        # Future open-answer type. Field is named "accepted_answers" upstream.
        return list(rec.get("accepted_answers", []))
    return []  # boolean: only the question text is translated


def _rebuild_record(
    src: dict[str, Any], pl_question: str, pl_answers: list[str]
) -> dict[str, Any]:
    """Assemble a Polish output record from the cleaned source + translations."""
    qtype = src["type"]
    out: dict[str, Any] = {
        "type": qtype,
        "difficulty": src["difficulty"],
        "category": CATEGORY_MAP.get(src["category"], src["category"]),
        "question": pl_question,
    }
    if qtype == "multiple":
        out["correct_answer"] = pl_answers[0]
        out["incorrect_answers"] = pl_answers[1:]
    elif qtype == "question":
        out["accepted_answers"] = pl_answers
    else:  # boolean — keep True/False; loader maps to a bool
        out["correct_answer"] = src["correct_answer"]
        out["incorrect_answers"] = src["incorrect_answers"]
    return out


async def _translate_batch(
    client: Any, model: str, batch: list[dict[str, Any]], max_retries: int = 4
) -> dict[int, dict[str, Any]]:
    """Translate one batch; returns {index: {"question":..., "answers":[...]}}.

    Items whose answer count comes back wrong are dropped (left for a re-run)
    rather than silently corrupting the data.
    """
    payload = [
        {
            "index": b["index"],
            "category": b["category"],
            "question": b["question"],
            "answers": b["answers"],
        }
        for b in batch
    ]
    expected_len = {b["index"]: len(b["answers"]) for b in batch}

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
                if idx not in expected_len:
                    continue
                if len(item.get("answers", [])) != expected_len[idx]:
                    # Length drift would misalign correct/incorrect — skip it.
                    continue
                result[idx] = {"question": item["question"], "answers": item["answers"]}
            return result
        except Exception as err:  # noqa: BLE001 - retry any transient API/JSON error
            last_err = err
            await asyncio.sleep(2 ** attempt)
    print(f"  ! batch failed after {max_retries} retries: {last_err}")
    return {}


def _iter_checkpoint(checkpoint: Path) -> "Any":
    """Yield parsed checkpoint rows, tolerating a truncated final line.

    A Ctrl-C landing mid-write can leave the last line incomplete; skip any
    unparseable line rather than crashing the next run (those indices simply
    get re-translated).
    """
    if not checkpoint.exists():
        return
    with checkpoint.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _load_done_indices(checkpoint: Path) -> set[int]:
    return {row["index"] for row in _iter_checkpoint(checkpoint)}


def _assemble(checkpoint: Path, output: Path) -> int:
    """Read the checkpoint, dedupe by index, write sorted final JSON."""
    by_index: dict[int, dict[str, Any]] = {}
    for row in _iter_checkpoint(checkpoint):
        by_index[row["index"]] = row["record"]
    records = [by_index[i] for i in sorted(by_index)]
    output.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return len(records)


async def run(args: argparse.Namespace) -> None:
    raw = json.loads(args.input.read_text(encoding="utf-8"))
    if args.limit:
        raw = raw[: args.limit]
    print(f"Loaded {len(raw)} questions from {args.input}")

    if args.assemble_only:
        n = _assemble(args.checkpoint, args.output)
        print(f"Assembled {n} records -> {args.output}")
        return

    # Build translation units (HTML-cleaned), skipping anything already done.
    done = _load_done_indices(args.checkpoint)
    if done:
        print(f"Resuming: {len(done)} already translated, skipping them.")

    units: list[dict[str, Any]] = []
    for idx, rec in enumerate(raw):
        if idx in done:
            continue
        clean = {k: _clean(v) for k, v in rec.items()}
        units.append(
            {
                "index": idx,
                "source": clean,
                "category": clean["category"],  # English category as model context
                "question": clean["question"],
                "answers": _translatable_answers(clean),
            }
        )

    if not units:
        print("Nothing to translate.")
    else:
        from openai import AsyncOpenAI  # imported lazily so --assemble-only needs no key

        client = AsyncOpenAI()
        batches = [units[i : i + args.batch_size] for i in range(0, len(units), args.batch_size)]
        sem = asyncio.Semaphore(args.concurrency)
        ckpt_lock = asyncio.Lock()
        done_count = 0
        total = len(units)

        async def worker(batch: list[dict[str, Any]]) -> None:
            nonlocal done_count
            async with sem:
                translations = await _translate_batch(client, args.model, batch)
            lines: list[str] = []
            for unit in batch:
                tr = translations.get(unit["index"])
                if tr is None:
                    continue  # left missing -> a future re-run retries it
                record = _rebuild_record(unit["source"], tr["question"], tr["answers"])
                lines.append(
                    json.dumps({"index": unit["index"], "record": record}, ensure_ascii=False)
                )
            if lines:
                async with ckpt_lock:
                    with args.checkpoint.open("a", encoding="utf-8") as fh:
                        fh.write("\n".join(lines) + "\n")
                    done_count += len(lines)
                    print(f"  progress: {done_count}/{total} translated")

        await asyncio.gather(*(worker(b) for b in batches))

    n = _assemble(args.checkpoint, args.output)
    print(f"Done. Assembled {n} records -> {args.output}")
    missing = len(raw) - n
    if missing:
        print(f"  ⚠ {missing} record(s) not translated — re-run to retry them.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate questions to Polish via OpenAI.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--batch-size", type=int, default=15)
    parser.add_argument("--concurrency", type=int, default=6)
    parser.add_argument("--limit", type=int, default=0, help="Translate only the first N (smoke test).")
    parser.add_argument("--assemble-only", action="store_true", help="Rebuild output from checkpoint; no API calls.")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
