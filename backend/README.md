# Quizowanie — Backend

FastAPI + async SQLAlchemy (asyncpg) + Neon Postgres.

The backend is intentionally small. The study engine (SM-2, next question,
stats) runs on the device; the server only:

1. **serves the question pool** — `GET /bundles/latest` (public), and
2. **mirrors each user's data** — `POST /sync` (Firebase token required), so a
   registered user can sync devices and restore after a reinstall.

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | — | Cloud Run probe |
| `GET /bundles/latest` | — | active + verified + public questions, categories, tombstones |
| `POST /sync` | Bearer (anon or linked) | push events/progress/authored questions/flags/prefs, pull what's missing |

Full reference: [../doc/BACKEND.md](../doc/BACKEND.md).

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Python 3.14 locally
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload                         # http://localhost:8000/docs
```

### `.env`

```
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json   # local dev only
CORS_ORIGINS=http://localhost:5173                            # comma-separated
```

Neon URLs can contain `sslmode` / `channel_binding`; `app/database.py` strips
them (asyncpg rejects them) and connects with `ssl=True`. `.env` and
`service-account.json` are gitignored — never commit them.

## Layout

```
app/
  main.py, config.py, database.py, dependencies.py   # app, settings, engine, auth
  models/     User, Category, Question, UserQuestionProgress, StudyAnswer, QuestionFlag
  schemas/    bundle, category, sync
  routers/    bundles.py, sync.py
  seeds/      question pipeline: translate → triage → review → compile → load
scripts/
  verify_sync.py        end-to-end check of /bundles/latest + /sync
  export_questions.py   dump DB questions back to seed JSON
alembic/                migrations (head: c9d8e7f6a5b4)
Dockerfile              Cloud Run image (python:3.12-slim, port $PORT)
```

## Common tasks

```bash
# Migrations
alembic revision --autogenerate -m "describe change"
alembic upgrade head

# Load the compiled question set (idempotent; data/ is gitignored)
python -m app.seeds.load_questions --file ../data/final_questions.json
python -m app.seeds.load_questions --dry-run

# Snapshot the DB pool to data/questions_backup_<date>.json
PYTHONPATH=. python scripts/export_questions.py

# Verify the sync protocol against DATABASE_URL (auth bypassed, self-cleaning)
PYTHONPATH=. python scripts/verify_sync.py
```

The AI pipeline stages need `OPENAI_API_KEY`; see
[../doc/DATA_PIPELINE.md](../doc/DATA_PIPELINE.md).

## Deploy

Cloud Run, `europe-west4`, built from the `Dockerfile` and deployed from the
GCP web console. Set `DATABASE_URL`, `FIREBASE_PROJECT_ID` and `CORS_ORIGINS` on the service
(use Workload Identity instead of a key file). Run migrations against the
production DB first when a release includes one.

## Rules

- Async everywhere; never `asyncio.gather` on one `AsyncSession`.
- Schema changes go through Alembic only.
- The server never runs SM-2 — progress is stored exactly as the client sent it.
- API error messages are in Polish.
