# Architecture

**Local-first** (since 2026-06-11): the on-device SQLite store is the source of
truth for the user — questions cache, SRS progress, and an append-only answer
log all live on the device. The study engine (SM-2, next-question staging,
stats) runs entirely client-side; the server is a **sync backend**, not the
live data path. The app is fully usable **anonymously and offline** (after a
one-time bundle download); an account only adds cross-device sync.

## Deployment topology (planned)

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
                       Backend:  GET /bundles/latest (public)  +  POST /study/sync (auth)
```

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

## Offline & sync model

- **Answers are immutable events**: every rating appends to a local
  `answer_events` row with a client-generated UUID. Sync = bulk POST to
  `/study/sync`; the server dedupes by `client_event_id` (**union semantics —
  re-posting is a no-op**), logs answers, and replays SM-2 in `answered_at`
  order.
- **Conflict policy**: per-question progress resolves **last-write-wins by
  `last_reviewed_at`** in both directions (server skips events older than its
  row; client only overwrites local rows when the server's is newer). Nothing
  is ever wiped.
- **Question pool**: fetched from the public `GET /bundles/latest` on first
  run, cached in SQLite, refreshed in background on later launches; tombstoned
  questions are deleted locally.
- **Sync triggers**: reconnect, tab refocus, session end, identity attach,
  registration. Anonymous users skip the round-trip when there's nothing to
  push (single device — nothing to pull).
- **SM-2 parity is a hard invariant**: `frontend/src/local/srs.ts` and
  `backend/app/services/srs.py` must produce identical schedules; guarded by
  `frontend/src/local/srs.test.ts` (fixture generated from the Python side).

## Data model overview (server)

```
users ──< study_sessions ──< study_answers >── questions >── categories (self-ref)
  │                              (client_event_id UNIQUE          │
  │                               = offline-sync idempotency)     │
  └──< user_question_progress >──────────────────────────────────┘
        (SM-2 state, unique per user+question)
```

- **users** — Firebase-backed identity (anon uids included) + `preferences` JSONB.
- **study_sessions** — live sessions + one synthetic session per sync batch.
- **study_answers.client_event_id** — UUID from the device's event log; NULL
  for answers submitted via the live endpoints.

The local SQLite schema mirrors this minus users/sessions (sessions are
in-memory client-side; the event log is the durable record). See
[FRONTEND.md](FRONTEND.md#local-store) and [BACKEND.md](BACKEND.md#database-schema).

## Cross-cutting conventions

- **Async everywhere** on the backend — async SQLAlchemy + asyncpg.
- **Polish UI strings** are hard-coded (no i18n library). Error `detail`
  messages from the API are also Polish.
- **Strict TypeScript** on the frontend; API/data shapes live in
  `frontend/src/types/api.ts`.
- **Theme is centralized** in `frontend/src/theme.ts` (dark mode, Inter font).
- **Answers live on-device** by design now (the local store needs them to grade
  offline); the legacy `/study/sessions/*` flow still withholds answers until
  submission but the frontend no longer uses it.
