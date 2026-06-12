# Backend Reference

FastAPI + async SQLAlchemy (asyncpg) + Neon Postgres.

The backend is deliberately minimal: the study engine (SM-2, next-question,
stats, preferences) runs **on-device** in the frontend. The server does exactly
two jobs — **provide the question pool** and **mirror per-user data** so a
registered user can sync across devices and fully restore after a reinstall.

## Project layout

```
backend/
  app/
    main.py            # app factory, CORS, router registration, lifespan→init_firebase
    config.py          # pydantic-settings (env vars)
    database.py        # async engine + AsyncSessionLocal + Base
    dependencies.py    # get_db, get_current_user (verifies token + auto-creates User), init_firebase
    models/
      user.py          # User (firebase_uid, email, preferences JSONB)
      category.py      # Category (self-referential parent_id)
      question.py      # Question + enums (Source, Type, VerificationStatus)
      progress.py      # UserQuestionProgress (client-computed SRS state, stored verbatim)
      answer.py        # StudyAnswer (per-user answer-event log + server_seq cursor)
    schemas/
      category.py, bundle.py, sync.py
    routers/
      bundles.py       # GET /bundles/latest (PUBLIC — no auth)
      sync.py          # POST /sync (mirror push + pull)
    seeds/             # data pipeline — see DATA_PIPELINE.md
  scripts/
    verify_sync.py     # in-process e2e check of /bundles/latest + /sync
                       # (auth overridden, self-cleaning; promote to pytest later)
  alembic/             # migrations (7 revisions)
  Dockerfile
  requirements.txt
```

There is **no registration endpoint**: `get_current_user` verifies the Firebase
bearer token and auto-creates the `users` row on first contact.

## Database schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| firebase_uid | VARCHAR UNIQUE (indexed) | |
| email | VARCHAR | from decoded token |
| created_at | TIMESTAMPTZ | |
| preferences | JSONB | default `{}`; mirror of the device's `meta.preferences` |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(200) | e.g. "Historia" |
| slug | VARCHAR(200) UNIQUE (indexed) | url-safe |
| parent_id | UUID FK → categories | NULL = top-level |

Self-referential; max 2 levels for MVP (category → subcategory).

### `questions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| type | ENUM `QuestionType` | `question` / `multiple` / `boolean` |
| text | TEXT | |
| answer | TEXT | canonical/display answer (SRS front) |
| payload | JSONB | type-specific answer structure (see below) |
| explanation | TEXT nullable | the "why" |
| mnemonic | TEXT nullable | |
| source | ENUM `QuestionSource` | `1z10_archive` / `milionerzy_archive` / `pubquiz_archive` / `opentdb` |
| verification_status | ENUM | `pending` / `verified` / `rejected` (default `pending`) |
| difficulty | SMALLINT nullable | 1–10 |
| category_id | UUID FK → categories | |
| is_active | BOOLEAN | default true; false = soft delete |
| created_at | TIMESTAMPTZ | |

**`payload` shape by type** (see docstring in `models/question.py`):
- `question` → `{"accepted": ["...", "..."]}` — any match counts
- `multiple` → `{"correct": "...", "incorrect": ["...", "...", "..."]}`
- `boolean`  → `{"correct": true}`

Only `is_active = true` AND `verification_status = verified` questions are
served in the bundle; the rest appear as tombstones (`deleted_ids`).

### `user_question_progress`
SM-2 state **computed by the client** and stored verbatim (the server runs no
SRS math). One row per (user, question); `UniqueConstraint(user_id, question_id)`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| question_id | UUID FK → questions | |
| repetitions | INT | consecutive correct reviews |
| easiness_factor | FLOAT | starts 2.5, floor 1.3 |
| interval_days | INT | |
| next_review_at | DATE nullable | SM-2 works in whole days |
| last_reviewed_at | TIMESTAMPTZ nullable | **LWW conflict key** |
| last_quality | SMALLINT nullable | 0/3/5 |

### `study_answers`
Per-user answer-event log — the server-side mirror of the device's
`answer_events` table. Append-only.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | indexed (with server_seq) |
| question_id | UUID FK → questions | |
| quality | SMALLINT | 0/3/5 |
| answered_at | TIMESTAMPTZ | |
| mode | VARCHAR(10) | `new` / `review` / `mixed` |
| client_event_id | UUID UNIQUE NOT NULL | device event UUID; sync idempotency key |
| server_seq | BIGINT IDENTITY | monotonic pull cursor |

### Migrations (Alembic, in order)
1. `897c2a87c2cd` — initial schema
2. `b2f1a7c4d3e9` — add question `type` + `payload`
3. `c3d2e1f0a9b8` — add `verification_status`
4. `d4e3f2a1b0c7` — add `preferences` to users
5. `e5f4a3b2c1d0` — add `mode` + `category_ids` to study_sessions
6. `f6a5b4c3d2e1` — add `client_event_id` to study_answers (offline sync)
7. `a7b6c5d4e3f2` — flatten sync: `study_answers` gains `user_id`/`mode`/`server_seq`,
   `client_event_id` NOT NULL, `session_id` dropped, **`study_sessions` dropped**

## API endpoints

Exactly three routes. `GET /health` and `GET /bundles/latest` are public;
`POST /sync` requires a Firebase bearer token (anonymous or linked).

### Health
```
GET /health           # Cloud Run probe → {"status":"ok"}
```

### Bundles (PUBLIC — offline question pool)
```
GET /bundles/latest   # no auth — anonymous clients download the pool on first run
```
Returns `{ version, question_count, questions[], categories[], deleted_ids[] }`.
`questions` are full rows (answer + payload included — the client grades
offline and builds options locally); active+verified only. `deleted_ids` are
tombstones (inactive/rejected) the client deletes locally. `version` is
`"{count}-{max_created_at}"` — good enough for the full-bundle MVP; delta
updates are post-launch.

### Sync (mirror push + pull)
```
POST /sync            # the device mirrors its user data and receives what it's missing
```

Request:
```json
{
  "events":   [ { "event_id": "uuid", "question_id": "uuid", "quality": 3,
                  "answered_at": "...", "mode": "mixed" } ],
  "progress": [ { "question_id": "uuid", "repetitions": 2, "easiness_factor": 2.5,
                  "interval_days": 6, "next_review_at": "2026-06-18",
                  "last_reviewed_at": "...", "last_quality": 3 } ],
  "preferences": { "show_options": true },
  "cursor": 0
}
```
- `events` — this device's unsynced answer events.
- `progress` — the device's **entire** local progress table.
- `preferences` — `null` means "never set locally" (fresh device); the server
  keeps its copy. Non-null replaces the server copy (client authoritative).
- `cursor` — highest `server_seq` the device has already pulled (0 = fresh).

Response: `{ synced, events, progress, preferences, cursor }`
- `synced` — how many pushed events were new (union by `client_event_id`).
- `events` — rows with `server_seq > request.cursor`, minus the ones just
  pushed. A fresh device (cursor 0) receives the **full answer history**, so
  streak/stats rebuild correctly — this is the restore-after-reinstall path.
- `progress` — ALL server rows for the user; the client applies LWW per
  question by `last_reviewed_at`.
- `cursor` — new high-water mark; the client persists it after storing events.

Semantics (`routers/sync.py`):
1. **Idempotent event union** — deduped against `study_answers.client_event_id`
   (and within the batch); re-posting a batch is a no-op (`synced: 0`).
2. **Progress LWW upsert** — `INSERT … ON CONFLICT (user_id, question_id) DO
   UPDATE … WHERE excluded.last_reviewed_at > current.last_reviewed_at`. A
   stale device cannot regress another device's schedule. No SM-2 on the
   server — rows are stored exactly as the client computed them.
3. Unknown/inactive `question_id`s are skipped silently (tombstoned questions).
4. Naive client timestamps are treated as UTC (`_as_utc`).

Verified end-to-end by `scripts/verify_sync.py` (idempotency, verbatim
storage, LWW guard, and the fresh-device full-restore pull).

## SM-2

Lives **only** in the frontend: `frontend/src/local/srs.ts`, with
`frontend/src/local/srs.test.ts` as the frozen reference fixture. The server
stores whatever schedule the client computed. Quality scale is 0/3/5
(Źle/Dobrze/Łatwe); `quality` is an unconstrained SMALLINT, so legacy rows from
the older 4-grade scale (containing `4`) remain valid history.

## Implementation notes

- **Neon + asyncpg SSL fix**: asyncpg rejects `sslmode`/`channel_binding` URL
  params. `database.py` strips them from `DATABASE_URL` and passes
  `connect_args={"ssl": True}` instead.
- **One AsyncSession = one connection**: never `asyncio.gather` queries on the
  same session (raises "session is provisioning a new connection") — await
  sequentially (see `routers/bundles.py`).
- `next_review_at` is a `DATE` (not timestamp) — SM-2 operates in whole days.
- Use Alembic for schema changes; never mutate schema in seed scripts.
- CORS origins come from `CORS_ORIGINS` env (comma-separated;
  default `http://localhost:5173`).
