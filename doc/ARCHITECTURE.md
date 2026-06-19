# Architecture

**Local-first** (since 2026-06-11): the on-device SQLite store is the source of
truth for the user — questions cache, SRS progress, and an append-only answer
log all live on the device. The study engine (SM-2, next-question staging,
stats) runs entirely client-side; the server is a **sync backend**, not the
live data path. The app is fully usable **anonymously and offline** (after a
one-time bundle download); an account only adds cross-device sync.

## Deployment topology

The local-first architecture below is **implemented** (since 2026-06-11). The
hosting targets are the intended production setup but are **not live yet** — the
Neon DB is a disposable test instance and there is no public web/Android deploy.

| Layer | Service | Role |
|---|---|---|
| Frontend | Firebase Hosting (web) + Capacitor (Android) | React + MUI SPA |
| Local store | SQLite (`@capacitor-community/sqlite`; `jeep-sqlite` wasm on web) | Source of truth on device |
| Auth | Firebase Auth | Anonymous-first; email/password + Google linking |
| API | Cloud Run | FastAPI container (`backend/Dockerfile`) — bundle + sync |
| Database | Neon Postgres | Canonical synced data (currently a disposable test DB) |

The API is **fully stateless** — no session state server-side. Firebase Auth
issues JWTs; FastAPI verifies them on every request via `firebase-admin`.

## Data flow

```
            ┌────────────── Frontend (web + Capacitor WebView) ──────────────┐
            │  UI/pages ── hooks ──► local/engine ──► local SQLite            │
            │                                  (questions, categories,        │
            │  AuthContext (anon → linked)      progress, answer_events,      │
            │        │                          meta)                         │
            │        ▼                                                        │
            │  sync/syncEngine ──(online & Firebase identity)──┐              │
            └─────────────────────────────────────────────────┼──────────────┘
                                                              ▼
                       Backend:  GET /bundles/latest (public)  +  POST /sync (auth)
```

The backend has exactly three routes (`/health`, `/bundles/latest`, `/sync`) —
it provides the question pool and mirrors per-user data, nothing else. The
study engine exists only on the device.

## Identity & auth flow

```
First launch (network needed ONCE, for the question bundle):
   local device_id created offline → study works immediately against SQLite
   signInAnonymously() attaches lazily when online (never blocks the app)
        ▼
Registration (optional, from CTA / Menu → /login):
   linkWithCredential / linkWithPopup onto the anon uid
   → uid preserved, server rows carry over seamlessly
   → fallback: account already exists → signInWithCredential; the event-log
     union merges both identities' data on the next sync
        ▼
Authenticated API calls (sync only):
   Axios interceptor (frontend/src/api/client.ts) adds
   Authorization: Bearer <firebase_id_token>  (anon or linked token)
   FastAPI get_current_user verifies + upserts a User row keyed by firebase_uid
```

There is **no login wall** — `ProtectedRoute` is a bundle-bootstrap gate, not
an auth gate.

**Storage partitioning note**: sign-in uses the **popup** flow only — the
redirect flow breaks under third-party storage partitioning (Firefox ETP,
Safari ITP). Popups must open directly from the click (no awaits first) or
strict browsers may silently block them. Before a public web deploy, serve
the Firebase auth helper from the app's own origin (custom `authDomain` +
reverse-proxy `/__/auth/*` → `pub-quizowanie.firebaseapp.com`) to eliminate
the third-party storage prompts entirely; on Capacitor/Android, Google
sign-in goes native instead (mobile track).

## Offline & sync model

- **The server mirrors, it doesn't compute**: `POST /sync` pushes this
  device's unsynced answer events, its **entire** client-computed progress
  table, any locally authored questions, queued question reports (flags), and
  preferences; the server stores them verbatim (no SM-2 replay) and returns what
  the device is missing (events, progress, the user's authored questions).
- **Answers are immutable events**: every rating appends to a local
  `answer_events` row with a client-generated UUID. The server dedupes by
  `client_event_id` (**union semantics — re-posting is a no-op**) and assigns
  each row a monotonic `server_seq`. The pull side returns events with
  `server_seq > cursor`, so a fresh device (cursor 0) receives the **full
  answer history** — streak and stats rebuild correctly after a reinstall or
  on a second device. This is the **restore guarantee**: a registered user can
  delete the app, return later on a new device, log in, and get everything
  back (events + progress + preferences).
- **Conflict policy**: per-question progress resolves **last-write-wins by
  `last_reviewed_at`** in both directions (server upserts only newer rows;
  client only overwrites local rows when the server's is newer). Nothing is
  ever wiped.
- **Question pool**: fetched from the public `GET /bundles/latest` on first
  run, cached in SQLite, refreshed in background on later launches; tombstoned
  questions are deleted locally.
- **Sync triggers**: reconnect, tab refocus, session end, identity attach,
  registration. Anonymous users skip the round-trip when there's nothing to
  push (single device — nothing to pull).
- **SM-2 lives only on the device**: `frontend/src/local/srs.ts` is the single
  implementation; `frontend/src/local/srs.test.ts` is its frozen reference
  fixture (a failing fixture means every user's schedule changes — only change
  it deliberately).

## Data model overview (server)

```
users ──< study_answers >── questions >── categories (self-ref)
  │         (client_event_id UNIQUE = idempotency,    │
  │          server_seq = pull cursor)                │
  ├──< user_question_progress >──────────────────────┤
  │     (client-computed SRS state, unique per user+question)
  ├──< questions.submitted_by   (user-authored questions)
  └──< question_flags >─────────────────────────────┘
        (write-only "zgłoś błąd" reports, client_id UNIQUE)
```

- **users** — Firebase-backed identity (anon uids included) + `preferences`
  JSONB (mirror of the device's preferences).
- **study_answers** — append-only mirror of the device `answer_events` log.
- **user_question_progress** — stored exactly as the client computed it.
- **questions** — shared pool + user submissions (`submitted_by`, `is_public`).
- **question_flags** — user question reports; write-only mirror of the local
  `question_flags` table, deduped by `client_id`.

The per-user tables are a **mirror of the local SQLite schema** (sessions are
in-memory client-side; the event log is the durable record). See
[FRONTEND.md](FRONTEND.md#local-store) and [BACKEND.md](BACKEND.md#database-schema).

## Cross-cutting conventions

- **Async everywhere** on the backend — async SQLAlchemy + asyncpg.
- **Polish UI strings** are hard-coded (no i18n library). Error `detail`
  messages from the API are also Polish.
- **Strict TypeScript** on the frontend; API/data shapes live in
  `frontend/src/types/api.ts`.
- **Theme is centralized** in `frontend/src/theme.ts` (dark mode, Inter font).
- **Answers live on-device** by design (the local store needs them to grade
  offline). The legacy `/study/sessions/*`, `/questions`, `/categories`,
  `/users/me/*`, and `/auth/me` endpoints were removed in the 2026-06-12
  backend cleanup.
