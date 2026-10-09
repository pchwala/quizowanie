# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quizowanie** is a Polish-language training platform for competitive quiz players — specifically for TV game shows like *1 z 10*, *Milionerzy*, and *PubQuiz*. Think Duolingo/Anki for Polish trivia enthusiasts.

The app is Polish and targets a Polish audience exclusively. All user-facing strings are Polish and hard-coded (no i18n).

**Status: v1** — the web app is deployed (Firebase Hosting + Cloud Run + Neon). Post-v1 work: Android (Capacitor), game modes, archive content, moderation tooling.

## Documentation

`doc/` is the implementation-accurate source of truth — read it before larger changes and keep it in sync with the code:

- `doc/README.md` — index; `doc/STATUS.md` — what's done/remaining; `doc/ROADMAP.md` — post-v1
- `doc/ARCHITECTURE.md`, `doc/FRONTEND.md`, `doc/BACKEND.md`, `doc/DATA_PIPELINE.md`, `doc/DEVELOPMENT.md`

`dev/` holds raw planning notes and per-feature plans (`dev/YYYY-MM-DD_<topic>.md`); they are historical, prefer `doc/`.

## Development Environment

Project root: `/home/user/Projects/quizowanie`

- **Backend** (`backend/`): FastAPI, Python 3.14, venv at `backend/.venv` (`source backend/.venv/bin/activate`). Run `uvicorn app.main:app --reload`; migrations via `alembic`.
- **Frontend** (`frontend/`): React 19 + Vite. `npm run dev | build | test | lint`. Lint has 7 known `react-hooks` errors — don't add new ones.

Do not create working branches, edit in current branch (`main`). Commit/push only when asked.

## Architecture (as built)

- **Local-first**: on-device SQLite (`frontend/src/local/`) is the source of truth; the study engine runs on the device and works anonymously and offline.
- **Backend has exactly 3 routes**: `GET /health`, `GET /bundles/latest` (public question pool), `POST /sync` (auth'd mirror of user data). Don't add server-side study logic.
- **SM-2 lives only in `frontend/src/local/srs.ts`**; `srs.test.ts` is a frozen fixture — a failing fixture changes every user's schedule, so only change it deliberately.
- **Auth**: Firebase, anonymous-first; registration links the credential onto the anonymous uid.

### Question Data Model

Every question carries:
- **Content**: type (`question` open / `multiple` ABCD / `boolean`), text, answer + JSONB `payload`, explanation (the "why"), optional mnemonic
- **Source**: one of `1z10_archive | milionerzy_archive | pubquiz_archive | opentdb | user_submission`
- **Verification status**: `verified | pending | rejected` — only active + verified + public questions ship in the bundle
- **Difficulty**: 1–10 (currently seeded from easy/medium/hard → 2/5/8; computed difficulty is roadmap)
- **Category / subcategory** (self-referential, 2 levels)
- User submissions: `submitted_by`, `is_public` (private ones never leave the author's account)

### Question Verification Workflow

User submissions are stored as `pending`; reports go to `question_flags`. Moderation is currently manual (DB updates). Planned: AI pre-screening (factual consistency, duplicate detection, spelling, category tagging) before human moderation. AI reduces moderator workload but is never the final authority.

### Post-v1

- **1 z 10 mode** — timed answers (5 s), streak tracking, pressure simulation (the study-session answer timer is the first step)
- **Milionerzy mode** — ABCD format with 50:50, ask-AI-audience, ask-AI-expert lifelines
- **Fact network** — when a user answers incorrectly, surface related facts/entities to support associative learning
