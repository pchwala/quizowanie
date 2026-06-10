# Backend Reference

FastAPI + async SQLAlchemy (asyncpg) + Neon Postgres. All MVP endpoints are
implemented and wired up — no stubs.

## Project layout

```
backend/
  app/
    main.py            # app factory, CORS, router registration, lifespan→init_firebase
    config.py          # pydantic-settings (env vars)
    database.py        # async engine + AsyncSessionLocal + Base
    dependencies.py    # get_db, get_current_user, init_firebase
    models/
      user.py          # User (firebase_uid, email, preferences JSONB)
      category.py      # Category (self-referential parent_id)
      question.py      # Question + enums (Source, Type, VerificationStatus)
      progress.py      # UserQuestionProgress (SM-2 state)
      session.py       # StudySession, StudyAnswer
    schemas/           # Pydantic request/response models
      user.py, category.py, question.py, study.py, stats.py
    routers/
      auth.py          # POST /auth/me
      categories.py    # GET /categories
      questions.py     # GET /questions, /browse/questions, /questions/{id}
      study.py         # POST/GET /study/sessions/*
      users.py         # GET /users/me/stats, GET/PATCH /users/me/preferences
    services/
      srs.py           # apply_sm2 + make_progress
      stats.py         # parallel stat aggregation queries
    seeds/             # data pipeline — see DATA_PIPELINE.md
  alembic/             # migrations (4 revisions)
  Dockerfile
  requirements.txt
```

## Database schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| firebase_uid | VARCHAR UNIQUE (indexed) | |
| email | VARCHAR | from decoded token |
| created_at | TIMESTAMPTZ | |
| preferences | JSONB | default `{}`; e.g. `{"show_options": bool}` |

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

Only `is_active = true` AND `verification_status = verified` questions appear in
study, list, and browse queries.

### `user_question_progress`
SM-2 state; one row per (user, question). `UniqueConstraint(user_id, question_id)`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| question_id | UUID FK → questions | |
| repetitions | INT | consecutive correct reviews; default 0 |
| easiness_factor | FLOAT | starts 2.5, floor 1.3 |
| interval_days | INT | default 0 |
| next_review_at | DATE nullable | SM-2 works in whole days |
| last_reviewed_at | TIMESTAMPTZ nullable | |
| last_quality | SMALLINT nullable | 0/3/5 |

### `study_sessions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| category_id | UUID FK nullable | NULL = all categories |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ nullable | |
| questions_answered | INT | incremented per answer |

### `study_answers`
One row per submitted answer; drives stats + weak-category aggregation.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → study_sessions | |
| question_id | UUID FK → questions | |
| quality | SMALLINT | 0/3/5 |
| answered_at | TIMESTAMPTZ | |

### Migrations (Alembic, in order)
1. `897c2a87c2cd` — initial schema
2. `b2f1a7c4d3e9` — add question `type` + `payload`
3. `c3d2e1f0a9b8` — add `verification_status`
4. `d4e3f2a1b0c7` — add `preferences` to users

## API endpoints

All routes except `GET /health` require a valid Firebase bearer token.

### Health & Auth
```
GET  /health          # public, Cloud Run probe → {"status":"ok"}
POST /auth/me         # verify token, upsert user, return UserResponse
```

### Categories
```
GET  /categories      # flat list ordered by name (parent_id present for nesting)
```

### Questions
```
GET  /questions                 # list; QuestionResponse (NO answer)
                                 # query: category_id, source, difficulty_min/max(1-10), limit(≤200), offset
GET  /browse/questions          # list; QuestionDetailResponse (WITH answer) — browse page
                                 # same filters + type (alias of q_type)
GET  /questions/{id}            # single QuestionDetailResponse (WITH answer/explanation/mnemonic)
```

`QuestionResponse` includes shuffled `options` for `multiple`/`boolean` types
(built in `_build_options`, never marks which is correct); `null` for open
questions. `boolean` options are `["Prawda", "Fałsz"]`.

Both list endpoints currently filter to `is_active = true` AND
`verification_status = verified`, ordered by `created_at`, paginated by
`limit`/`offset`.

### Study
```
POST /study/sessions                     # body {category_id?}; validates category; 201 → StudySessionResponse
GET  /study/sessions/{id}/next           # next question (QuestionResponse, no answer); 404 when exhausted
POST /study/sessions/{id}/answer         # body {question_id, quality∈{0,3,5}}; applies SM-2, logs answer
                                         #   → SubmitAnswerResponse {correct_answer, explanation, mnemonic}
POST /study/sessions/{id}/end            # 204; sets ended_at
```

**Next-question selection** (`get_next_question` in `routers/study.py`):
1. **Stage 1 — due SRS**: progress rows for this user with `next_review_at <= today`,
   joined to active+verified questions, ordered `next_review_at ASC` (most overdue first).
2. **Stage 2 — unseen**: active+verified questions with no progress row for this
   user, ordered by `Question.id` (deterministic).
3. Session `category_id` filter applied to both stages.
4. `404 Brak pytań do nauki` when both empty.

The endpoint is **idempotent** per session: re-fetching before an answer returns
the same question (handles reconnects). `submit_answer` rejects answers on an
already-ended session (`400`).

### Users
```
GET   /users/me/stats         # UserStatsResponse
GET   /users/me/preferences   # UserPreferences (from users.preferences JSONB)
PATCH /users/me/preferences   # merge-update preferences
```

`UserStatsResponse`:
```python
{
  due_today: int,          # progress rows with next_review_at <= today
  total_studied: int,      # count of progress rows (questions seen)
  streak_days: int,        # consecutive days with ≥1 answer (alive if today or yesterday)
  total_questions: int,    # active + verified questions in DB
  weak_categories: [       # bottom 5 by avg quality, min 5 answers each
    { category_id, category_name, avg_quality }   # avg rounded to 2 dp
  ]
}
```

Stats run all five queries concurrently via `asyncio.gather` (`services/stats.py`).
Weak-category thresholds: `_WEAK_CATEGORY_MIN_ANSWERS = 5`, `_WEAK_CATEGORY_LIMIT = 5`.

## SM-2 algorithm (`services/srs.py`)

Three-grade scale **0 (wrong) / 3 (good) / 5 (easy)** — constants `WRONG, GOOD,
EASY`. The grading is explicit per-grade (not the parametric SM-2 EF formula) so
that **good is a neutral pass** (easiness factor unchanged); only wrong and easy
move the EF.

```python
def apply_sm2(progress, quality):
    if quality == WRONG:                       # 0 — reset, review tomorrow, EF penalty
        progress.repetitions = 0
        interval = 1
        progress.easiness_factor = max(1.3, progress.easiness_factor - 0.2)
    else:                                       # GOOD (3) or EASY (5)
        if   progress.repetitions == 0: interval = 1
        elif progress.repetitions == 1: interval = 6
        else: interval = round(progress.interval_days * progress.easiness_factor)
        progress.repetitions += 1
        if quality == EASY:                     # 5 — interval bonus + EF bump
            interval = round(interval * 1.3)
            progress.easiness_factor = progress.easiness_factor + 0.15
        # GOOD (3): easiness factor unchanged

    progress.interval_days  = interval
    progress.next_review_at = date.today() + timedelta(days=interval)
    progress.last_reviewed_at = now(utc)
    progress.last_quality = quality
```

- **Wrong (0):** repetitions → 0, interval → 1 day, EF −0.2 (floored at 1.3).
- **Good (3):** normal progression 1 → 6 → `round(interval * EF)`, EF unchanged.
- **Easy (5):** same progression with a ×1.3 interval bonus, EF +0.15.

EF starts 2.5, floors at 1.3. New questions get a fresh row via `make_progress`
(`repetitions=0, ef=2.5, interval_days=0`) on first answer.

Quality button mapping (frontend): Źle→0, Dobrze→3, Łatwe→5. (Switched from the
older 4-grade scale — Again/Hard/Good/Easy 0/3/4/5 — in June 2026. No DB
migration: `quality` is an unconstrained SMALLINT, so legacy rows containing `4`
remain valid and only blend into historical `avg_quality`.)

## Implementation notes

- **Neon + asyncpg SSL fix**: asyncpg rejects `sslmode`/`channel_binding` URL
  params. `database.py` strips them from `DATABASE_URL` and passes
  `connect_args={"ssl": True}` instead.
- `next_review_at` is a `DATE` (not timestamp) — SM-2 operates in whole days.
- Use Alembic for schema changes; never mutate schema in seed scripts.
- CORS origins come from `CORS_ORIGINS` env (comma-separated;
  default `http://localhost:5173`).
</content>
