"""
Human review tool for the triage review band.

Auto-routing (applied before any human input):
  quality=2, relevance=1  → approve
  quality=0               → drop
  quality=1, relevance≥1  → human decision (the real review queue)

Interactive keys for each human-review item:
  a — approve (accept as-is)
  d — drop (reject)
  e — edit Polish text, then approve
  s — skip (decide later)
  q — quit and save progress

Outputs:
  data/review_decisions.json           — final decisions for all review_queue items
  data/review_decisions.checkpoint.jsonl — resumable; one {index, decision, question_pl} per line

Usage:
  python -m app.seeds.review_questions
  python -m app.seeds.review_questions --queue data/review_queue.json
  python -m app.seeds.review_questions --assemble-only   # rebuild output, no interaction
"""

import argparse
import json
import os
import readline
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"

DEFAULT_QUEUE = _DATA_DIR / "review_queue.json"
DEFAULT_OUTPUT = _DATA_DIR / "review_decisions.json"
DEFAULT_CHECKPOINT = _DATA_DIR / "review_decisions.checkpoint.jsonl"

# ANSI colour helpers — disabled when not a TTY
_IS_TTY = sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    if not _IS_TTY:
        return text
    return f"\033[{code}m{text}\033[0m"


def _bold(t: str) -> str:
    return _c("1", t)


def _dim(t: str) -> str:
    return _c("2", t)


def _green(t: str) -> str:
    return _c("32", t)


def _red(t: str) -> str:
    return _c("31", t)


def _yellow(t: str) -> str:
    return _c("33", t)


def _cyan(t: str) -> str:
    return _c("36", t)


# ── routing ──────────────────────────────────────────────────────────────────

def _auto_decision(item: dict) -> str | None:
    """Return 'approve'/'drop' if the score makes the call, else None (human)."""
    q, r = item["quality"], item["relevance"]
    if q == 2 and r == 1:
        return "approve"
    if q == 0:
        return "drop"
    return None  # quality=1, relevance=1 or 2 → human


# ── checkpoint I/O ───────────────────────────────────────────────────────────

def _load_checkpoint(path: Path) -> dict[int, dict]:
    """Return {index: {decision, question_pl}} from the checkpoint."""
    done: dict[int, dict] = {}
    if not path.exists():
        return done
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                done[row["index"]] = row
            except json.JSONDecodeError:
                pass  # tolerate truncated trailing line
    return done


def _append_checkpoint(path: Path, index: int, decision: str, question_pl: str | None) -> None:
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"index": index, "decision": decision, "question_pl": question_pl}, ensure_ascii=False) + "\n")


# ── display ───────────────────────────────────────────────────────────────────

def _clear() -> None:
    if _IS_TTY:
        os.system("clear")


def _show_item(item: dict, pos: int, total: int) -> None:
    _clear()
    pct = round(pos / total * 100) if total else 0
    print(_bold(f"  Pytanie {pos}/{total} ({pct}%)  ") + _dim(f"[index={item['index']}]"))
    print()

    cat = item.get("category", "")
    if cat:
        print(_dim(f"  Kategoria: {cat}"))

    q_score = item["quality"]
    r_score = item["relevance"]
    flags = item.get("flags", [])
    note = item.get("note", "")

    score_str = f"quality={q_score}  relevance={r_score}"
    print(_dim(f"  Ocena AI:  {score_str}"))
    if flags:
        print(_yellow(f"  Flagi:     {', '.join(flags)}"))
    if note:
        print(_yellow(f"  Uwaga:     {note}"))
    print()

    print(_bold("  EN: ") + item.get("question_en", ""))
    print()
    print(_bold("  PL: ") + _cyan(item.get("question_pl", "")))

    answers = item.get("answers_pl", [])
    if answers:
        print()
        print(_dim("  Odpowiedzi:"))
        for ans in answers:
            print(_dim(f"    • {ans}"))

    print()
    print("  " + _green("[a]zatwierdź") + "  " + _red("[d]odrzuć") + "  " + _yellow("[e]dytuj+zatwierdź") + "  [s]kip  [q]uit")
    print()


def _edit_text(current: str) -> str:
    """Prompt for edited Polish text, pre-filled with current value."""
    def _hook():
        readline.insert_text(current)
        readline.redisplay()

    readline.set_pre_input_hook(_hook)
    try:
        result = input("  Edytuj PL: ")
    finally:
        readline.set_pre_input_hook(None)
    return result.strip() or current


def _get_key(prompt: str = "") -> str:
    """Read a single keypress without requiring Enter."""
    import termios
    import tty
    if prompt:
        print(prompt, end="", flush=True)
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
    return ch


# ── assembly ──────────────────────────────────────────────────────────────────

def _assemble(queue: list[dict], checkpoint: dict[int, dict], output: Path) -> None:
    decisions: list[dict] = []
    counts = {"approve": 0, "drop": 0, "skip": 0}

    for item in queue:
        idx = item["index"]
        auto = _auto_decision(item)

        if idx in checkpoint:
            row = checkpoint[idx]
            decisions.append({
                "index": idx,
                "decision": row["decision"],
                "question_pl": row.get("question_pl"),
            })
            counts[row["decision"]] = counts.get(row["decision"], 0) + 1
        elif auto is not None:
            decisions.append({"index": idx, "decision": auto, "question_pl": None})
            counts[auto] += 1
        else:
            # Not yet decided — leave as skip
            decisions.append({"index": idx, "decision": "skip", "question_pl": None})
            counts["skip"] += 1

    output.write_text(json.dumps(decisions, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nDecisions written to {output}")
    print(f"  approve : {counts.get('approve', 0)}")
    print(f"  drop    : {counts.get('drop', 0)}")
    print(f"  skip    : {counts.get('skip', 0)}")


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Human review for triage band.")
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--assemble-only", action="store_true")
    args = parser.parse_args()

    queue: list[dict] = json.loads(args.queue.read_text(encoding="utf-8"))
    checkpoint = _load_checkpoint(args.checkpoint)

    # Split into auto-decided and human-review
    human_items = [it for it in queue if _auto_decision(it) is None and it["index"] not in checkpoint]
    auto_approve = sum(1 for it in queue if _auto_decision(it) == "approve")
    auto_drop = sum(1 for it in queue if _auto_decision(it) == "drop")
    already_done = len(checkpoint)

    print(f"Loaded {len(queue)} review-band items.")
    print(f"  Auto-approve (q=2,r=1): {auto_approve}")
    print(f"  Auto-drop    (q=0):     {auto_drop}")
    print(f"  Already reviewed:       {already_done}")
    print(f"  Remaining human review: {len(human_items)}")

    if args.assemble_only or not human_items:
        if not human_items:
            print("Nothing left to review.")
        _assemble(queue, checkpoint, args.output)
        return

    print("\nStarting review session. Press any key to begin...")
    if _IS_TTY:
        _get_key()

    total = len(human_items)
    for pos, item in enumerate(human_items, 1):
        _show_item(item, pos, total)

        while True:
            key = _get_key().lower() if _IS_TTY else input("  [a/d/e/s/q]: ").strip().lower()[:1]

            if key == "a":
                _append_checkpoint(args.checkpoint, item["index"], "approve", None)
                checkpoint[item["index"]] = {"decision": "approve", "question_pl": None}
                break
            elif key == "d":
                _append_checkpoint(args.checkpoint, item["index"], "drop", None)
                checkpoint[item["index"]] = {"decision": "drop", "question_pl": None}
                break
            elif key == "e":
                print()
                edited = _edit_text(item["question_pl"])
                _append_checkpoint(args.checkpoint, item["index"], "approve", edited)
                checkpoint[item["index"]] = {"decision": "approve", "question_pl": edited}
                break
            elif key == "s":
                break  # skip — no checkpoint entry, will show again next run
            elif key == "q":
                print("\n\nQuit. Saving progress...")
                _assemble(queue, checkpoint, args.output)
                sys.exit(0)
            elif key == "\x03":  # Ctrl-C
                print("\n\nInterrupted.")
                _assemble(queue, checkpoint, args.output)
                sys.exit(0)

    print("\nAll items reviewed!")
    _assemble(queue, checkpoint, args.output)


if __name__ == "__main__":
    main()
