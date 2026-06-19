# Data Pipeline

How the question bank is built. The MVP general pool is **OpenTDB translated to
Polish**, run through an AI triage + human review + compile + load pipeline.
Scripts live in `backend/app/seeds/`; intermediates in `data/`.

## Pipeline at a glance

```
all_questions.json (EN, 4738)
   │  translate_questions.py   (OpenAI: translate text + answers to Polish)
   ▼
pytania.json (PL, 4738)
   │  triage_questions.py      (LLM-as-judge: relevance 0-2, quality 0-2 → buckets)
   ▼
triage.json + review_queue.json
   │  review_questions.py      (human review of the "review" band)
   ▼
review_decisions.json
   │  compile_questions.py     (merge translation + triage + decisions)
   ▼
final_questions.json (4500)
   │  load_questions.py        (upsert categories + insert questions into Postgres)
   ▼
Neon Postgres `questions` / `categories`
```

Every API-calling stage is **resumable** via a `*.checkpoint.jsonl` keyed by
source index, and supports `--assemble-only` to rebuild outputs without API
calls. Requires `OPENAI_API_KEY` for the translate/triage stages.

## Stages

### 1. `translate_questions.py`
Reads `data/all_questions.json` (English OpenTDB), writes `data/pytania.json`
(Polish, same schema). Per record: HTML-unescapes, maps category to Polish via a
static table (no API cost), translates question text and — for
`multiple`/`question` — the answer strings (keeping proper nouns/titles
unchanged). `boolean` answers stay `True`/`False`. Checkpoint:
`pytania.checkpoint.jsonl`.

### 2. `triage_questions.py`
LLM-as-judge over Polish + English (aligned by position). Scores each question:
- **relevance** 0–2 — worthwhile for a *general Polish* audience?
- **quality** 0–2 — is the Polish translation correct and natural?

Buckets:
- `approve` — relevance 2 AND quality 2 (spot-check only)
- `drop` — relevance 0 (irrelevant for PL audience)
- `review` — everything else → human queue

Outputs `data/triage.json` (all scores) + `data/review_queue.json` (review band
with EN+PL side by side). Checkpoint: `triage.checkpoint.jsonl`.

### 3. `review_questions.py`
Interactive human review tool for the review band. Auto-routes before human
input (`quality=2,relevance=1→approve`; `quality=0→drop`; `quality=1,relevance≥1→human`).
Keys: `a` approve · `d` drop · `e` edit Polish then approve · `s` skip · `q` quit.
Outputs `data/review_decisions.json` (+ `review_decisions.checkpoint.jsonl`).
`--assemble-only` rebuilds output without interaction.

### 4. `compile_questions.py`
Merges `pytania.json` + `triage.json` + `review_decisions.json` into
`data/final_questions.json`. Inclusion rules (in order):
- triage `drop` → excluded
- triage `approve` → included, `verification_status = verified`
- triage `review`:
  - decision `approve` → included, `verified` (uses edited Polish if `question_pl` set)
  - decision `drop` → excluded
  - decision `skip` → included, `verification_status = pending`

Output record shape:
```json
{
  "type": "multiple|boolean|question",
  "difficulty": "easy|medium|hard",
  "category": "Kategoria Nadrzędna: Podkategoria",
  "question": "...", "correct_answer": "...",
  "incorrect_answers": ["..."], "accepted_answers": ["..."],
  "verification_status": "verified|pending", "source": "opentdb"
}
```

### 5. `load_questions.py`
Loads `final_questions.json` into the DB. Upserts categories (parent/child split
on `': '`, slugified), maps difficulty `easy/medium/hard → 2/5/8`, builds the
JSONB `payload` per type, **skips questions whose text is already in the DB**
(idempotent), inserts in batches of 500.

```bash
cd backend
python -m app.seeds.load_questions                       # default final_questions.json
python -m app.seeds.load_questions --file data/final_questions.json
python -m app.seeds.load_questions --dry-run
```

### Reverse: `scripts/export_questions.py`
Dumps the DB's `questions` + `categories` back into the seed JSON shape — useful
for snapshotting the live bank or round-tripping edits made directly in Postgres
back into a reloadable file. Lives in `backend/scripts/` (not `app/seeds/`).

## Data files (`data/`)

| File | Stage | Notes |
|---|---|---|
| `all_questions.json` | input | English OpenTDB, 4738 |
| `pytania.json` | 1 out | Polish translation, 4738 (`pytania_old.json` = prior version) |
| `triage.json`, `review_queue.json` | 2 out | scores + review band |
| `review_decisions.json` | 3 out | human decisions |
| `final_questions.json` | 4 out | compiled, 4500 — DB-ready |
| `*.checkpoint.jsonl` | — | resumable progress for each AI stage |

## Future sourcing

The OpenTDB pool powers the daily SRS loop and a future "1 z 10 mode". Authentic
archive content (Milionerzy via Fandom CC-BY-SA, PubQuiz community DBs, 1z10 via
YouTube ASR) is the real differentiator but not yet ingested — see
[ROADMAP.md](ROADMAP.md) and `dev/DATA_SOURCING.md`. The next likely task is a
Milionerzy Fandom-wiki scraper emitting the seed JSON format above.
</content>
