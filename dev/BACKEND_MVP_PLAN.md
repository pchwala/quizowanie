# Backend MVP Plan

## Scope

Backend only. No AI features, no user submissions, no moderation queue. Questions are loaded by admin via seed scripts. Game modes (1z10, Milionerzy, PubQuiz) are post-MVP.

---

## Deployment Architecture

| Layer | Service | Role |
|---|---|---|
| Frontend | Firebase Hosting | React + MUI SPA |
| Auth | Firebase Auth | Identity provider |
| API | Cloud Run | FastAPI container |
| Database | Neon Postgres | All persistent app data |

Firebase Auth issues JWTs. FastAPI verifies them on every request using `firebase-admin` SDK. No session state in the API — fully stateless.

---

## Auth Flow

1. User signs in via Firebase Auth on the frontend (email/password or OAuth).
2. Frontend attaches `Authorization: Bearer <firebase_id_token>` to every API request.
3. FastAPI dependency `get_current_user` verifies the token with `firebase_admin.auth.verify_id_token()`.
4. On first verified request, a `User` row is created in Postgres keyed by `firebase_uid`.
5. All subsequent DB lookups use the internal `user.id` (UUID), not the Firebase UID.

```python
# Dependency used by all protected routes
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    decoded = firebase_admin.auth.verify_id_token(token)
    user = db.query(User).filter_by(firebase_uid=decoded["uid"]).first()
    if not user:
        user = User(firebase_uid=decoded["uid"], email=decoded.get("email"))
        db.add(user); db.commit()
    return user
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| firebase_uid | VARCHAR UNIQUE | |
| email | VARCHAR | |
| created_at | TIMESTAMP | |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | e.g. "Historia", "Geografia" |
| slug | VARCHAR UNIQUE | url-safe |
| parent_id | UUID FK → categories | NULL = top-level |

Self-referential for subcategories. Keep to max 2 levels (category → subcategory) for MVP.

### `questions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| text | TEXT | |
| answer | TEXT | |
| explanation | TEXT | nullable |
| mnemonic | TEXT | nullable |
| source | ENUM | `1z10_archive`, `milionerzy_archive`, `pubquiz_archive` |
| difficulty | SMALLINT | 1–10, nullable initially |
| category_id | UUID FK → categories | |
| is_active | BOOLEAN | default true; false = soft delete |
| created_at | TIMESTAMP | |

### `user_question_progress`

Holds SM-2 state per user per question. Row is created on first encounter.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| question_id | UUID FK → questions | |
| repetitions | INT | number of consecutive correct reviews |
| easiness_factor | FLOAT | starts at 2.5 |
| interval_days | INT | days until next review |
| next_review_at | DATE | |
| last_reviewed_at | TIMESTAMP | |
| last_quality | SMALLINT | 0–5, last answer quality |

Unique constraint on `(user_id, question_id)`.

### `study_sessions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| category_id | UUID FK | nullable; NULL = all categories |
| started_at | TIMESTAMP | |
| ended_at | TIMESTAMP | nullable |
| questions_answered | INT | incremented as answers come in |

### `study_answers`

Log of every answer submitted. Drives statistics and weakness tracking.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → study_sessions | |
| question_id | UUID FK | |
| quality | SMALLINT | 0–5 |
| answered_at | TIMESTAMP | |

---

## SM-2 Algorithm

Quality scale: 0–5 (0–2 = wrong/hard, 3 = correct with difficulty, 4 = correct, 5 = perfect).

```python
def apply_sm2(progress: UserQuestionProgress, quality: int) -> UserQuestionProgress:
    if quality >= 3:
        if progress.repetitions == 0:
            interval = 1
        elif progress.repetitions == 1:
            interval = 6
        else:
            interval = round(progress.interval_days * progress.easiness_factor)
        progress.repetitions += 1
    else:
        progress.repetitions = 0
        interval = 1

    progress.easiness_factor = max(
        1.3,
        progress.easiness_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
    progress.interval_days = interval
    progress.next_review_at = date.today() + timedelta(days=interval)
    progress.last_reviewed_at = datetime.utcnow()
    progress.last_quality = quality
    return progress
```

New questions (no `UserQuestionProgress` row yet) are treated as `repetitions=0, interval=0`.

---

## API Endpoints

All routes except health check require a valid Firebase token.

### Auth
```
GET  /health                   # public, Cloud Run health probe
POST /auth/me                  # verify token, upsert user, return profile
```

### Categories
```
GET  /categories               # full tree (flat list with parent_id)
```

### Questions
```
GET  /questions                # list; query params: category_id, source, difficulty_min, difficulty_max, limit, offset
GET  /questions/{id}           # single question with explanation + mnemonic
```

Questions endpoint never returns the answer — answer is only returned in the study flow after submission.

### Study
```
POST /study/sessions                     # start a session; body: { category_id? }; returns session_id
GET  /study/sessions/{session_id}/next   # get next question for this session
POST /study/sessions/{session_id}/answer # body: { question_id, quality: 0-5 }; returns correct answer + SM-2 update + next question hint
POST /study/sessions/{session_id}/end    # close session
```

**Next question selection logic** inside `GET .../next`:
1. Due SRS questions first (`next_review_at <= today`, ordered by `next_review_at ASC`).
2. Then unseen questions (no `user_question_progress` row), ordered randomly.
3. Respect `category_id` filter from session if set.
4. Return 404 when nothing left in session.

### Progress & Stats
```
GET  /users/me/stats           # total seen, total due today, streak, weak categories (by avg quality)
GET  /users/me/progress        # paginated list of user_question_progress rows
```

**Weak categories**: aggregate `study_answers` by `question.category_id`, compute average quality, return bottom N.

---

## Project Structure

```
app/
  main.py              # FastAPI app factory, router registration
  config.py            # settings via pydantic-settings (env vars)
  database.py          # SQLAlchemy engine + session factory
  dependencies.py      # get_db, get_current_user
  models/
    user.py
    question.py
    category.py
    progress.py
    session.py
  schemas/             # Pydantic request/response models
  routers/
    auth.py
    categories.py
    questions.py
    study.py
    users.py
  services/
    srs.py             # apply_sm2 + next-question selection logic
    stats.py           # stats aggregation queries
  seeds/
    load_questions.py  # admin CLI to import questions from CSV/JSON
```

---

## Environment Variables

```
DATABASE_URL=postgresql+asyncpg://...   # Neon connection string (use asyncpg for async SQLAlchemy)
FIREBASE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=...     # path to service account JSON (local dev)
                                        # use Workload Identity on Cloud Run
```

---

## Data Seeding

Questions are loaded from structured CSV or JSON via `seeds/load_questions.py`. Script is run manually via `python -m app.seeds.load_questions --file data/1z10.json`. No admin UI in MVP.

Seed format (JSON):
```json
[
  {
    "text": "...",
    "answer": "...",
    "explanation": "...",
    "mnemonic": null,
    "source": "1z10_archive",
    "difficulty": 5,
    "category_slug": "historia"
  }
]
```

---

## Key Implementation Notes

- Use **async SQLAlchemy** (`asyncpg` driver) from the start — Cloud Run is single-instance by default so sync would block, and migrating later is painful.
- Use **Alembic** for migrations. Never mutate schema in seed scripts.
- `next_review_at` is a `DATE` (not `TIMESTAMP`) — SM-2 operates in whole days.
- The `/study/sessions/{id}/next` endpoint is idempotent per session — re-fetching returns the same question until an answer is submitted. This handles mobile reconnects.
- Questions with `is_active = false` are excluded from all queries (soft delete for future content moderation).
