# Quizowanie — Project Documentation

> Single source of truth for the Quizowanie codebase. Link this folder into new
> Claude/dev sessions for full project context.

**Quizowanie** is a Polish-language spaced-repetition training platform for
competitive quiz-show players — *1 z 10*, *Milionerzy*, *PubQuiz*. Think
Duolingo/Anki for Polish trivia. Polish UI, Polish audience only.

The MVP (web app) is **functionally complete**: backend at 100% of MVP scope,
frontend essentially done. As of 2026-06-11 the app is **local-first**: it works
anonymously and offline against on-device SQLite, with optional account
registration + server sync (pre-Capacitor groundwork). Remaining work is
testing and the Android (Capacitor) track.

---

## How this folder is organized

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, deployment topology, auth flow, request lifecycle |
| [BACKEND.md](BACKEND.md) | FastAPI app: layout, DB schema, every endpoint, SM-2, stats |
| [FRONTEND.md](FRONTEND.md) | React SPA: layout, pages, study flow, hooks, types |
| [DATA_PIPELINE.md](DATA_PIPELINE.md) | How the question bank is built (translate → triage → review → compile → load) |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Run it locally, env vars, migrations, seeding |
| [STATUS.md](STATUS.md) | What's done, what remains, known bugs |
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
scoped to categories), flips flashcards, self-rates recall quality
(Źle/Dobrze/Łatwe), and the SM-2 algorithm schedules each question's next
review — all on-device, offline-capable. Stats surface weak categories and
streaks. Registering (optional) syncs progress across devices.

## Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript (strict) + MUI v9 + TanStack Query v5 + Zustand |
| Local store | Capacitor SQLite (`jeep-sqlite` wasm on web) — source of truth on device |
| Mobile shell | Capacitor (Android; `android/` scaffold pending) |
| Auth | Firebase Auth — anonymous-first; email/password + Google linking |
| API | FastAPI + async SQLAlchemy (asyncpg) — question bundle + sync backend |
| DB | Neon Postgres (currently a disposable test instance) |
| Hosting (planned) | Firebase Hosting (web) + Cloud Run (API) |
| Migrations | Alembic |

## Repo layout

```
backend/        FastAPI app, models, routers, services, Alembic, seed pipeline
frontend/       React + Vite SPA
data/           Question dataset + pipeline intermediates (JSON/JSONL)
dev/            Original planning notes (superseded by /doc)
doc/            ← you are here
CLAUDE.md       Product brief + working rules
```
</content>
</invoke>
