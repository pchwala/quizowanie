# Quizowanie — Project Documentation

> Single source of truth for the Quizowanie codebase. Link this folder into new
> Claude/dev sessions for full project context.

**Quizowanie** is a Polish-language spaced-repetition training platform for
competitive quiz-show players — *1 z 10*, *Milionerzy*, *PubQuiz*. Think
Duolingo/Anki for Polish trivia. Polish UI, Polish audience only.

**Status: v1 feature-complete** (reconciled 2026-10-09). The web app is
deployed (Firebase Hosting + Cloud Run + Neon). It is **local-first**: it works
anonymously and offline against on-device SQLite, with optional account
registration + server sync. v1 includes SRS flashcards scoped by source and
category, an optional answer timer, browsing/searching the question pool,
user-submitted questions, question reporting ("zgłoś błąd") and stats.
The Android (Capacitor) build and game modes are post-v1.

---

## How this folder is organized

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, deployment topology, auth flow, request lifecycle |
| [BACKEND.md](BACKEND.md) | FastAPI app: layout, DB schema, the 3 endpoints, sync semantics |
| [FRONTEND.md](FRONTEND.md) | React SPA: layout, local store, study flow, sync, pages |
| [DATA_PIPELINE.md](DATA_PIPELINE.md) | How the question bank is built (translate → triage → review → compile → load) |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Run it locally, env vars, migrations, seeding |
| [STATUS.md](STATUS.md) | v1 feature set, deployment, what remains, known issues |
| [ROADMAP.md](ROADMAP.md) | Post-MVP: game modes, mobile (Android), monetization, data sourcing |

The original brainstorming/planning notes live in [`../dev/`](../dev/). These
`/doc` files are the curated, implementation-accurate version — prefer them.
`../CLAUDE.md` holds the high-level product brief and house rules.

---

## The product in one loop

```
Answer questions → identify weaknesses → schedule SRS reviews → improve retention
```

A user opens the app (no account needed), starts a study session (optionally
scoped to sources and categories, optionally against a timer), flips flashcards, self-rates recall quality
(Źle/Dobrze/Łatwe), and the SM-2 algorithm schedules each question's next
review — all on-device, offline-capable. Stats surface weak categories and
streaks. Registering (optional) syncs progress across devices.

## Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript (strict) + MUI v9 (+ @mui/x-charts) + TanStack Query v5 + Zustand |
| Local store | Capacitor SQLite (`jeep-sqlite` wasm on web) — source of truth on device |
| Mobile shell | Capacitor (Android; `android/` scaffold pending) |
| Auth | Firebase Auth — anonymous-first; email/password + Google linking |
| API | FastAPI + async SQLAlchemy (asyncpg) — question bundle + sync backend |
| DB | Neon Postgres |
| Hosting | Firebase Hosting (web) + Cloud Run `europe-west4` (API) |
| Migrations | Alembic |

## Repo layout

```
backend/        FastAPI app, models, routers, schemas, Alembic, seed pipeline + scripts
frontend/       React + Vite SPA
data/           Question dataset + pipeline intermediates (gitignored, local only)
dev/            Planning notes and per-feature plans (superseded by /doc)
doc/            ← you are here
README.md       Repo entry point
CLAUDE.md       Product brief + working rules for Claude Code
```
</content>
</invoke>
