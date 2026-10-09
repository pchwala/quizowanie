# Quizowanie

A Polish-language training app for competitive quiz players — *1 z 10*,
*Milionerzy*, *PubQuiz*. Think Anki/Duolingo for Polish trivia: answer
questions, find your weak spots, and let spaced repetition (SM-2) bring them
back at the right time.

The app is **local-first**: it works anonymously and offline from on-device
SQLite. Creating an account (email or Google) only adds cross-device sync and
restore.

**Status: v1** — web app deployed (Firebase Hosting + Cloud Run + Neon).
Android via Capacitor is next. See [doc/STATUS.md](doc/STATUS.md).

## Features (v1)

- Flashcard study with SM-2 spaced repetition — new, review and mixed modes
- Scope a session by **source** and **category**
- Optional **answer timer** (1 z 10–style pressure)
- Open, ABCD and true/false questions; clickable options
- Browse and search the whole question pool, with filters and pagination
- Stats: streak, weak categories, daily activity
- Write your own questions (private, or public for moderation)
- Report wrong questions („zgłoś błąd”)
- No login wall; optional account syncs progress and restores it on any device

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, MUI v9, TanStack Query, Zustand |
| On-device store | SQLite via Capacitor (`jeep-sqlite` wasm on web) |
| Auth | Firebase Auth (anonymous-first, account linking) |
| Backend | FastAPI, async SQLAlchemy + asyncpg, Alembic |
| Database | Neon Postgres |
| Hosting | Firebase Hosting (web), Cloud Run (API) |

## Repository

```
frontend/   React SPA (+ Capacitor config)        → frontend/README.md
backend/    FastAPI bundle + sync API, data pipeline → backend/README.md
doc/        Project documentation (start at doc/README.md)
dev/        Planning notes and per-feature plans
data/       Question dataset files (gitignored)
```

## Quick start

```bash
# Backend — http://localhost:8000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in DATABASE_URL, FIREBASE_PROJECT_ID, ...
alembic upgrade head
uvicorn app.main:app --reload

# Frontend — http://localhost:5173
cd frontend
npm install
# create .env.local with VITE_API_URL + VITE_FIREBASE_* (see frontend/README.md)
npm run dev
```

The first app launch downloads the question pool from the backend; after that
it runs offline.

## Documentation

| Doc | Covers |
|---|---|
| [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) | Local-first design, auth, sync model, deployment |
| [doc/FRONTEND.md](doc/FRONTEND.md) | SPA layout, local store, study flow, pages |
| [doc/BACKEND.md](doc/BACKEND.md) | Schema, endpoints, sync semantics |
| [doc/DATA_PIPELINE.md](doc/DATA_PIPELINE.md) | How the question bank is built |
| [doc/DEVELOPMENT.md](doc/DEVELOPMENT.md) | Local setup, env vars, migrations, deploy |
| [doc/STATUS.md](doc/STATUS.md) | v1 feature set, what remains, known issues |
| [doc/ROADMAP.md](doc/ROADMAP.md) | Game modes, archive content, Android, monetization |

The question pool is based on [Open Trivia DB](https://opentdb.com)
(CC BY-SA 4.0), translated to Polish and curated.
