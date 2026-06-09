# Development

## Prerequisites

- Python 3.14 with a venv at `backend/.venv`
- Node + npm (frontend)
- A Neon Postgres database
- A Firebase project (Auth + service account)

## Backend

```bash
cd backend
source .venv/bin/activate          # venv lives at backend/.venv
pip install -r requirements.txt    # fastapi, uvicorn, sqlalchemy[asyncio], asyncpg,
                                   # alembic, pydantic-settings, firebase-admin, openai, ...
alembic upgrade head               # apply migrations
uvicorn app.main:app --reload      # serves on http://localhost:8000
```

Interactive API docs at `http://localhost:8000/docs`.

### Backend env (`backend/.env`, see `.env.example`)
```
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json   # local dev only
CORS_ORIGINS=http://localhost:5173                            # comma-separated
```

On Cloud Run, use Workload Identity instead of a service-account JSON file.
`service-account.json` is gitignored — never commit it.

> **Neon/asyncpg note**: `DATABASE_URL` may contain `sslmode`/`channel_binding`
> from Neon's UI. `database.py` strips them automatically and uses
> `connect_args={"ssl": True}`. Keep the `postgresql+asyncpg://` scheme.

## Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # tsc -b && vite build  → dist/
npm run lint       # eslint
npm run preview    # preview the production build
```

### Frontend env
`VITE_API_URL` — backend base URL (defaults to `http://localhost:8000` if unset).
Firebase web config lives in `src/firebase.ts`.

## Migrations (Alembic)

```bash
cd backend
alembic revision --autogenerate -m "describe change"   # create
alembic upgrade head                                    # apply
alembic downgrade -1                                    # roll back one
```

Current head: `d4e3f2a1b0c7` (add preferences to users). Never mutate schema in
seed scripts — migrations only.

## Seeding the question bank

Full pipeline in [DATA_PIPELINE.md](DATA_PIPELINE.md). To just load the
already-compiled set:

```bash
cd backend
python -m app.seeds.load_questions          # loads data/final_questions.json (idempotent)
python -m app.seeds.load_questions --dry-run
```

The AI stages (`translate_questions.py`, `triage_questions.py`) need
`export OPENAI_API_KEY=sk-...`.

## Working conventions (from CLAUDE.md)

- **Do not create working branches.** Edit on the active feature branch so the
  user sees edits live in the editor. The user runs a single instance at a time.
- Polish is the product language; all user-facing strings are Polish.
- Keep `dev/` as raw planning notes; keep `doc/` implementation-accurate.

## Git

- Current working branch: `front-refactor`. Main branch: `main`.
- Commit/push only when asked.
</content>
