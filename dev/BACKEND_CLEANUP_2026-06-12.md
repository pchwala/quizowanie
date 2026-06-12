# Backend Cleanup + Mirror Sync Protocol — plan & execution record (2026-06-12)

> Status: **implemented and verified** on branch `feature`, 2026-06-12.
> This file preserves the plan and what was actually done, for future reference.
> Implementation-accurate docs live in `doc/` (BACKEND.md has the full `/sync`
> contract); this is the raw planning/decision record.

## Why

After the local-first refactor (2026-06-11) the entire study engine (SM-2,
next-question, stats, browse, preferences) ran on-device and the frontend made
exactly two HTTP calls (`GET /bundles/latest`, `POST /study/sync`). Everything
else on the backend was dead code, and the old sync (server-side SM-2 replay +
synthetic StudySessions) was broken in practice and conceptually wrong. The
cleanup cut the backend down to its real job: **question provider + per-user
data mirror**.

## Decisions (user-locked)

1. **No SM-2 on the server.** The client pushes events + its computed progress
   rows + preferences; the server stores verbatim. `services/srs.py` deleted;
   the Python↔TS parity invariant died with it — `frontend/src/local/srs.ts`
   is the single implementation, `srs.test.ts` its frozen reference fixture.
2. **Server DB mirrors the local DB for user data** (events, progress,
   preferences), bidirectionally. Questions/categories flow the other way
   (server → client via bundle). `study_sessions` had no local counterpart
   (sessions are in-memory client-side) → dropped.
3. **Restore guarantee (hard requirement):** a registered user can delete the
   app, return on a fresh device anytime, log in, and get everything back. A
   fresh device's first sync (`cursor=0`, empty push) pulls the complete
   server copy: full event history (so streak/stats rebuild), all progress,
   preferences. Only unavoidable loss window: answers given offline after the
   last successful sync if the app is deleted before reconnecting.
4. Neon was a disposable test DB → destructive forward migration OK.
5. **Out of scope** (next phases, seams left clean): bundled question JSON in
   the app build (replacing fetch-on-first-run), auth-flow analysis,
   login/logout account-switch edge cases.

## What was removed

| Deleted | Why |
|---|---|
| `routers/auth.py` (`POST /auth/me`) | redundant — `get_current_user` verifies token AND auto-creates the User row |
| `routers/questions.py`, `routers/categories.py` | dead — pool ships in the bundle |
| `routers/users.py` (stats + preferences endpoints) | replaced by local compute + sync |
| `routers/study.py` (all `/study/sessions/*` + old `/study/sync`) | replaced by `routers/sync.py` |
| `services/` (`srs.py`, `stats.py`) | no server SRS; stats only fed `/users/me/stats` |
| `schemas/study.py`, `stats.py`, `user.py`, `question.py` | only used by deleted routers |
| `models/session.py` → `models/answer.py` | `StudySession` deleted; `StudyAnswer` reworked |

Kept: `schemas/category.py` (imported by `schemas/bundle.py`), `bundle.py`,
`routers/bundles.py`, `dependencies.py`, `database.py`, `config.py`, seeds.

## Final backend surface (3 routes)

- `GET /health` — probe
- `GET /bundles/latest` — PUBLIC question pool + tombstones
- `POST /sync` — mirror push/pull (Firebase bearer, anon or linked)

## New sync protocol — `POST /sync`

Request:
```json
{
  "events":   [ { "event_id", "question_id", "quality", "answered_at", "mode" } ],
  "progress": [ { "question_id", "repetitions", "easiness_factor", "interval_days",
                  "next_review_at", "last_reviewed_at", "last_quality" } ],
  "preferences": { } ,
  "cursor": 0
}
```
- `progress` = the client's ENTIRE local progress table.
- `preferences: null` = "never set locally" (fresh device) — server copy kept;
  non-null replaces the server copy (client authoritative, last-pusher-wins).
- `cursor` = highest `server_seq` the device has pulled (0 = fresh).

Response `{ synced, events, progress, preferences, cursor }`:
- events unioned idempotently by `client_event_id` (re-post = no-op);
- progress upserted per (user, question) with LWW guard
  `excluded.last_reviewed_at > current.last_reviewed_at`;
- pull returns events with `server_seq > cursor` (minus the just-pushed ones),
  ALL progress rows (client LWW-applies), preferences, new cursor.

Server implementation notes: naive timestamps coerced to UTC (`_as_utc`);
unknown/inactive question ids skipped silently; single AsyncSession — never
`asyncio.gather`; known accepted race: concurrent same-user syncs can commit
identity values out of order so a cursor may skip one event (negligible for
passive-trigger single-user multi-device).

## Schema migration `a7b6c5d4e3f2` (applied to Neon 2026-06-12)

`study_answers` became a pure per-user event log:
1. `user_id` added, backfilled from `study_sessions` join, NOT NULL + FK;
2. legacy NULL `client_event_id` backfilled with the row PK, then NOT NULL;
3. `mode` added (server_default 'mixed');
4. `server_seq` BIGINT IDENTITY added (PG backfills), index `(user_id, server_seq)`;
5. `session_id` dropped, **`study_sessions` table dropped**.

Downgrade raises NotImplementedError (disposable test DB).

## Frontend changes

- `src/sync/syncEngine.ts` reworked: pushes events + full progress + raw
  `meta.preferences` (NOT `getLocalPreferences()` — defaults would defeat
  null-means-unset) + `sync_cursor`; pulls missing events (`INSERT OR IGNORE`,
  `synced=1` — rebuilds history/stats on fresh devices), LWW progress apply,
  prefs only when locally unset, persists cursor after event inserts. Toast
  count = pushed + pulled. Triggers/mutex/anonymous-skip unchanged.
- `src/local/srs.ts` + `srs.test.ts` comments reframed (frozen fixture, not
  parity). Fixture values untouched.
- `src/types/api.ts`: unused `User` interface removed; stale comments fixed.

## Verification (all passed 2026-06-12)

1. Route surface check — exactly `/health`, `/bundles/latest`, `/sync`.
2. `alembic upgrade head` on Neon; 250 legacy rows migrated cleanly.
3. `backend/scripts/verify_sync.py` (rewritten): bundle 200 → push (synced=2,
   progress stored VERBATIM, prefs echoed, no own-batch echo) → duplicate
   batch no-op → **fresh-device full-restore pull** → stale-push LWW guard →
   1 DB row per event → self-cleanup.
4. Frontend `npm run build` + `npm test` green; lint still the same 7
   pre-existing errors (none in touched files).
5. Manual two-device mirror smoke (left to do by hand): profile A studies +
   changes pref + syncs; fresh profile B logs in → stats/streak/progress/pref
   match; B answers, syncs; A refocuses → A includes it. Clearing A's site
   data and logging in again = the delete-app-and-return restore test.

## Accepted trade-offs / seams for later

- Preferences are last-pusher-wins once set locally → seam:
  `preferences_updated_at` LWW column.
- Full-progress push grows linearly with studied questions → seam: delta push
  by `last_reviewed_at > last_sync_at`.
- `server_seq` identity-gap race (see above) → revisit only if sync becomes
  high-frequency.
- Legacy pre-sync rows pulled as ordinary events (stats-only effect, harmless).

## Next phases (not started)

1. Ship the question pool **in the app build** (bundled JSON imported on first
   run; `GET /bundles/latest` becomes background refresh only).
2. Auth-flow analysis (anonymous → link/login paths).
3. Account-switch edge cases: anonymous-then-login merge, logout → different
   account on the same device.
