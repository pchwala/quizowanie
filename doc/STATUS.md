# Status — Done / Remaining / Known Issues

_Last reconciled against the code on 2026-06-19 (branch `feature`)._

The MVP web app is functionally complete. What's left is testing and minor bug
polish.

## User submissions + reporting (2026-06-18)

Two UGC features shipped end-to-end (the "bootstrap volume via community"
half of the content strategy):

- **User-submitted questions** — author open / ABCD / boolean questions
  (`AddQuestionPage`), private or public. Backend gained `submitted_by` +
  `is_public` on `questions` (migration `b8c7d6e5f4a3`) and a `user_submission`
  source. The local `questions` table gained `is_user_owned` / `is_public` /
  `verification_status`; `/sync` now mirrors authored questions both ways
  (insert-only, immutable by id) so a fresh device restores them with their
  current status. `MojePytaniaPage` lists them with a status chip.
- **Question reporting ("zgłoś błąd")** — `ReportQuestionDialog` + a new
  `question_flags` table both locally and server-side (`QuestionFlag` model,
  migration `c9d8e7f6a5b4`). Flags are pushed write-only via `/sync`, deduped by
  `client_id`. No moderation/admin UI yet — `status` is set manually.
- **Daily-activity tracking + charts** — `DailyActivityChart` /
  `WeakCategoriesChart` (`@mui/x-charts`), driven by `useDailyActivity` /
  `useUserStats` over the local `answer_events` log.

Current migration head: **`c9d8e7f6a5b4`** (9 revisions total).
AI pre-screening of submissions is **not** wired yet (still roadmap).

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
| Sync engine (mirror push/pull + full restore; events/progress/authored/flags) + toast | Done |
| AppShell + BottomNav (Nauka / Pytania / Menu) | Done |
| Study flow (Setup → FlashCard → Rating → Complete) | Done |
| Clickable options on flashcard for multiple/boolean | Done |
| Browse page (filters + pagination + answer view) | Done |
| Stats (StatCards + WeakCategoriesChart + DailyActivityChart) | Done |
| User submissions (AddQuestionPage + MojePytaniaPage) | Done |
| Question reporting (ReportQuestionDialog → local flags → sync) | Done |
| MenuPage settings (display name + sign-out + show_options + daily_limit) | Done |
| ErrorBoundary | Done |
| All API clients / hooks / types | Done |

> Note: earlier handoff notes (`dev/HANDOFF.md`, 2026-06-08) referenced a
> separate StatsPage and SettingsPage. The mobile-first refactor folded those
> into NaukaPage (stats) and MenuPage (settings) under a BottomNav; ErrorBoundary
> is implemented and wired in. Treat this STATUS.md as current.

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
