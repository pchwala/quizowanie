# Session Handoff — Question Types & Polish Translation Pipeline

**Date:** 2026-06-05
**Branch:** `worktree-db-question-types` (in git worktree `.claude/worktrees/db-question-types`)
**Base:** `feature` — this branch is **merged**.
**Scope:** backend only (`backend/`).

---

## 1. Goal of this work

Quizowanie needs to ingest ~4.7k trivia questions from an English **OpenTDB** export
(`data/all_questions.json`), but (1) the DB schema only supported a single open-answer
shape, and (2) the data is English while the app is Polish-only. This session:

- Extended the schema to support **multiple question types**.
- Built a **resumable OpenAI translation pipeline** (English → Polish).
- Built an **AI triage (LLM-as-judge)** pass to score relevance + translation quality
  and shrink human moderation to a small review band.

---

## 2. Completed work (committed on this branch)

| Commit | What |
|--------|------|
| `e245430` | Schema: question types + payload + translation script |
| `722f737` | Fix: tolerate truncated trailing checkpoint line on resume |
| `12ea8da` | Translator: category context + exonym rule (quality) |
| `82f1b71` | Triage: LLM-as-judge for relevance + quality |

### 2a. Schema changes
- `backend/app/models/question.py`
  - New `QuestionType` enum: `question` (open text), `multiple` (ABCD, 1 correct),
    `boolean` (true/false).
  - New columns: `type` (enum) and `payload` (JSONB). `answer` kept as the canonical
    display answer.
  - Added `opentdb` value to `QuestionSource`.
  - **Payload shapes:**
    - `question` → `{"accepted": ["...", "..."]}`
    - `multiple` → `{"correct": "...", "incorrect": ["...", "...", "..."]}`
    - `boolean`  → `{"correct": true}`
- `backend/app/models/__init__.py` — exports `QuestionType`.
- `backend/app/schemas/question.py`
  - `QuestionResponse` gains `type` + pre-answer `options` (shuffled choices for
    `multiple`, labels for `boolean`, `None` for open) — **router must populate
    `options` without leaking the correct answer** (router is still a stub).
  - `QuestionDetailResponse` gains full `payload`.
- `backend/alembic/versions/b2f1a7c4d3e9_add_question_type_and_payload.py`
  - New migration chained off the initial revision (`897c2a87c2cd`). Adds the two
    columns + `questiontype` enum + `opentdb` enum value.
  - **NOT YET APPLIED to the DB.** Apply with: `cd backend && .venv/bin/alembic upgrade head`

### 2b. Translation script — `backend/app/seeds/translate_questions.py`
- Reads `data/all_questions.json` → writes Polish `data/pytania.json` in the **same
  schema** `load_questions.py` expects.
- Model **gpt-4.1-mini**, batched (15/req), async (6 concurrent), strict structured
  outputs, exponential-backoff retries.
- HTML-unescapes everything; maps all **24 categories** to Polish via a static table
  (keeps `: ` separator for parent/child splitting).
- Sends the **category as context** and uses a **keep-titles / use-Polish-exonyms**
  prompt rule (added in `12ea8da` after first-pass quality issues).
- `boolean`: only the question is translated; `correct_answer`/`incorrect_answers`
  stay `True`/`False` (loader maps to bool; UI shows Prawda/Fałsz).
- Supports the future `question` type → `accepted_answers` (none in current data).
- **Resumable:** appends to `data/pytania.checkpoint.jsonl` keyed by source index;
  re-runs skip done indices; tolerant of a truncated final line. `--assemble-only`
  rebuilds output with no API calls.

### 2c. Triage script — `backend/app/seeds/triage_questions.py`
- Loads Polish `pytania.json` + English `all_questions.json`, aligned **by position**
  (hard length-mismatch guard).
- Judge model scores each question: **relevance** 0–2, **quality** 0–2, controlled
  **flags** (`leftover_english`, `mistranslation`, `us_centric`, …), one-line Polish note.
- Routes into buckets: `approve` (rel 2 & qual 2), `drop` (rel 0), `review` (rest).
- Emits `data/triage.json` (full scores) and `data/review_queue.json` (review band
  with EN+PL side by side) + prints bucket counts & flag frequencies.
- Same resumable checkpoint pattern (`data/triage.checkpoint.jsonl`), reuses
  `_clean` / `_iter_checkpoint` from the translator.

### 2d. Supporting changes
- `backend/requirements.txt` — added `openai`.
- `.gitignore` — added `data/` (local datasets + generated checkpoints/outputs).

---

## 3. Key decisions made this session (so you don't relitigate)

- **Answer storage:** JSONB `payload` on a single table (not a relational options table).
- **Source tagging:** OpenTDB data → `source = opentdb`.
- **Difficulty:** source `easy/medium/hard` → int **2/5/8** (done by the *loader*, not yet built).
- **Categories:** free-text `Entertainment: Video Games` → split on `: ` into
  parent/child via the existing self-referential `Category` model. Polish names via
  static map in the translator.
- **Translation:** translate question + answers, **preserve proper nouns/titles**,
  use Polish exonyms for places/people/species. Model = gpt-4.1-mini.
- **Booleans:** keep `True`/`False` in data; localize in UI.
- **Moderation strategy:** AI triage to auto-approve/drop the obvious, human reviews
  only the middle band. **No crowd moderation for MVP** (maybe a "report" button later).

---

## 4. Dataset facts

- `data/all_questions.json`: **4738** questions (not 5000), git-ignored, only in the
  **feature checkout** (NOT in the worktree).
- Types present: `multiple` (4021), `boolean` (717). **No `question` type** in this data.
- Difficulty: medium 2162 / easy 1587 / hard 989.
- 24 distinct categories (largest: Video Games 1106, Music 418, General Knowledge 401).
- HTML entities present (`&amp;`, `&#039;`, `&quot;`).

---

## 5. Current TODOs (open)

1. **Run the fresh re-translation** with the improved prompt (user said they would).
   → produces `data/pytania.json`.
2. **Run triage** → `data/triage.json` + `data/review_queue.json`. The printed bucket
   counts decide how much human work is actually needed.
3. **(b) Verification-status schema** — add `verification_status` enum
   (`verified | pending | rejected`, per CLAUDE.md plan) + optional AI score/flag fields
   to `Question`, plus a migration. Needed to persist triage outcomes.
4. **Wire up `load_questions.py`** (currently a stub at `backend/app/seeds/load_questions.py`):
   read `pytania.json`, upsert categories (split on `: `, slugify, parent/child),
   map difficulty easy/medium/hard → 2/5/8, build per-type JSONB `payload`,
   set `source=opentdb`, dedup. Should consume triage results to set verification_status
   and skip `drop` items.
5. **(d) Human review tool** — consume `data/review_queue.json`; side-by-side EN|PL + AI
   flags, keyboard approve/reject/edit. CLI or tiny web view.
6. **Apply the migration** (`b2f1a7c4d3e9`) to the DB once schema is final
   (consider folding the verification-status change into one migration if done before applying).
7. **Implement the question router** (`backend/app/routers/questions.py`) — both endpoints
   are stubs. List endpoint must populate `options` and never leak the answer.
8. **(optional) Batch API mode** — OpenAI Batch API is ~50% cheaper (async, up to 24h).
   Designed but NOT built: add `--mode batch-submit` / `--mode batch-fetch` to the
   translator (and/or triage); ~80% of code reusable. Good for the full re-translation.
9. **Reconcile Python version** — CLAUDE.md says 3.12; `backend/.venv` is actually 3.14.

---

## 6. Recommended next steps (in order)

1. **User runs re-translation, then triage** (smoke-test each with `--limit 20` first).
   Read the triage bucket counts before building more — they tell you whether the
   problem is small (just do (d) review tool) or large (consider Batch re-translation
   or dropping more categories).
2. **(b) verification_status schema** — small, unblocks persisting triage results.
   Fold it into a single migration with `b2f1a7c4d3e9` IF the DB hasn't been migrated yet.
3. **Wire `load_questions.py`** consuming `pytania.json` + triage results → first real
   data in the DB. This is the milestone that makes the rest testable.
4. **(d) review tool** for the flagged band.
5. **Question router** so the API can actually serve questions.

---

## 7. How to run things

```bash
# venv is at backend/.venv (Python 3.14), NOT repo-root .venv
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...

# Translate (resumable). Smoke-test first.
python -m app.seeds.translate_questions --limit 20
python -m app.seeds.translate_questions          # full; delete checkpoint to redo

# Triage (after pytania.json exists)
python -m app.seeds.triage_questions --limit 20
python -m app.seeds.triage_questions

# Apply schema migration
.venv/bin/alembic upgrade head
```

---

## 8. Caveats / gotchas

- **Paths:** both scripts default to `<repo-root>/data/`. They derive repo root from
  `Path(__file__).resolve().parents[3]`. **In the worktree `data/` does not exist**
  (git-ignored, only in the feature checkout). Run from the feature checkout after merging,
  or pass explicit `--input/--output/--polish/--source`.
- **Re-translation after prompt change:** the checkpoint skips done indices, so a plain
  re-run will NOT pick up the improved (`12ea8da`) prompt. Delete
  `data/pytania.checkpoint.jsonl` for a clean full re-run.
- **EN/PL alignment in triage:** relies on `pytania.json` being parallel (same length,
  same order) to `all_questions.json`. If translation left gaps, fill them (re-run
  translate) before triage; the script hard-errors on length mismatch.
- **Migration not applied yet.** The initial migration (`897c2a87c2cd`) is presumably
  already on the dev DB; `b2f1a7c4d3e9` is new and unapplied. Postgres can't remove an
  enum value, so `opentdb` persists after downgrade (documented in the migration).
- **No live API calls were made this session** — all OpenAI runs are the user's to execute.
- **DB is Postgres (asyncpg / Neon-style).** JSONB is available and used.

---

## 9. Verification done this session

- All changed files `py_compile` clean.
- SQLAlchemy `configure_mappers()` succeeds; enums + JSONB + new Pydantic fields resolve.
- Translator offline logic tested on real data: HTML unescape, 0 unmapped categories,
  multiple/boolean rebuild, category reaches payload, truncated-checkpoint tolerance.
- Triage offline logic tested: bucket routing, EN/PL alignment, answer extraction,
  assembly (buckets/flags/review queue), length-mismatch guard.


## Additional
Output of running triage:

Scored 4738 questions:
  approve : 1748
  review  : 2882
  drop    : 108
Top flags:
    706  niche
    130  awkward_phrasing
    104  us_centric
     29  factual_doubt
     26  mistranslation
     21  leftover_english
     15  grammar
      6  ambiguous
      5  untranslatable_wordplay