# Status — Done / Remaining / Known Issues

_Last reconciled against the code on 2026-06-12 (branch `feature`)._

The MVP web app is functionally complete. What's left is testing and minor bug
polish.

## Backend cleanup + mirror sync (2026-06-12)

The backend was cut down to its real job — question provider + user-data
mirror. Exactly **3 routes** remain: `GET /health`, `GET /bundles/latest`
(public), `POST /sync` (auth).

- **Removed**: `/auth/me` (redundant — `get_current_user` auto-creates the
  user), `/categories`, `/questions*`, `/browse/questions`, all
  `/study/sessions/*` endpoints, `/users/me/stats`, `/users/me/preferences`,
  `services/srs.py`, `services/stats.py`, and the matching schemas. The SM-2
  Python↔TS parity invariant is gone — `frontend/src/local/srs.ts` is the only
  implementation (frozen fixture in `srs.test.ts`).
- **New sync protocol** (`POST /sync`): the client pushes unsynced events, its
  entire client-computed progress table, and preferences; the server stores
  verbatim (events unioned by `client_event_id`, progress LWW by
  `last_reviewed_at`, prefs replaced when non-null) and returns events the
  device is missing (`server_seq > cursor`), all progress, and prefs. A fresh
  device's first sync is a **full restore** (the registered-user guarantee:
  delete the app, come back anytime, log in, everything returns).
- **Migration `a7b6c5d4e3f2`** (applied to Neon): `study_answers` gained
  `user_id`/`mode`/`server_seq`, `client_event_id` NOT NULL, `session_id`
  dropped, `study_sessions` dropped.
- **Verified 2026-06-12**: `backend/scripts/verify_sync.py` (rewritten) passes
  end-to-end against Neon — idempotent union, verbatim progress storage, LWW
  guard, fresh-device full-restore pull, preferences round-trip. Frontend
  build + vitest green.

## Local-first refactor (2026-06-11) — pre-Capacitor

The app was inverted to **local-first + anonymous use + account sync**. No
login wall: the study engine (SM-2, next-question staging, stats) now runs
on-device against a Capacitor SQLite store (`jeep-sqlite` wasm on web), and the
server became a sync backend.

- **Question pool**: fetched on first run from the **public**
  `GET /bundles/latest` (network required once), cached in SQLite, refreshed in
  background with tombstone deletes (`frontend/src/local/bundle.ts`).
- **Identity**: study never blocks on auth. `signInAnonymously()` attaches
  lazily when online (`AuthContext`); registering **links** the credential onto
  the anon uid (`LoginPage`), with sign-in fallback when the account exists.
- **Sync & conflicts**: answers are immutable events (client UUIDs) in a local
  `answer_events` log — **idempotent union** server-side; per-question
  progress resolves **last-write-wins by `last_reviewed_at`** in both
  directions. (Protocol since revised — see the 2026-06-12 section above.)
- Unused `api/*` clients were removed (only `client.ts` stays, for
  bundles + sync).

**Remaining for this refactor:**
1. `npx cap add android` + the mobile UI polish track
   (`dev/MOBILE_CONSIDERATIONS.md` §6+). `capacitor.config.ts`, `base: './'`,
   and the SQLite layer are already in place.
2. Lint carries 7 pre-existing `react-hooks` v7 errors (`useStudySession` refs
   pattern, `CategoryPickerModal`, `AuthContext` fast-refresh) — untouched by
   this refactor.
3. Promote `scripts/verify_sync.py` into a proper pytest suite once test infra
   lands (point it at a non-shared Postgres before Neon becomes real prod).

## Backend — minimal by design

The study engine lives in the frontend; the backend has exactly the routes it
needs (post-cleanup, 2026-06-12):

| Endpoint | Status |
|---|---|
| `GET /health` | Done |
| `GET /bundles/latest` | Done — PUBLIC; offline question pool + tombstones |
| `POST /sync` | Done — mirror push/pull: event union, progress LWW, prefs, `server_seq` pull cursor |

Data: `data/final_questions.json` holds 4500 compiled questions ready to load.

## Frontend — essentially complete

| Feature | Status |
|---|---|
| Anonymous-first auth (lazy anon uid; email/Google account **linking**) | Done |
| Local SQLite store + offline study engine (`src/local/`) | Done |
| Bundle bootstrap gate + background refresh | Done |
| Sync engine (mirror push/pull + full restore) + toast | Done |
| AppShell + responsive sidebar | Done |
| Study flow (Setup → FlashCard → Rating → Complete) | Done |
| Clickable options on flashcard for multiple/boolean | Done |
| Browse page (filters + pagination + answer view) | Done |
| StatsPage (StatCards + WeakCategoriesChart) | Done |
| SettingsPage (display name + sign-out + show_options) | Done |
| ErrorBoundary | Done |
| All API clients / hooks / types | Done |

> Note: earlier handoff notes (`dev/HANDOFF.md`, 2026-06-08) listed StatsPage,
> SettingsPage, and ErrorBoundary as stubs/missing. They have since been
> implemented — the files exist and are wired in. Treat this STATUS.md as
> current.

## Remaining work

1. **Testing** — vitest now exists with the SM-2 fixture suite
   (`frontend/src/local/srs.test.ts`); `backend/scripts/verify_sync.py` covers
   sync e2e. Still missing: next-question staging, local stats aggregation
   (streak + weak categories), the study-flow hook, and a real pytest suite.
2. **Real-device/manual testing** of the local-first flows (first run, offline
   study, registration sync, multi-device merge, delete-app-and-restore).
3. **Minor bug fixes** — see below.

## Recently shipped (git history)

- Clickable options on flashcard for multiple/boolean questions.
- FlashCard flip no longer flashes the answer during flip.
- `useStudySession` flip-state management corrected.
- Browse page recreated with pagination groundwork.
- Planning docs: data sourcing, monetization, Android port plan.
</content>
