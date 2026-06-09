# Status — Done / Remaining / Known Issues

_Last reconciled against the code on 2026-06-09 (branch `front-refactor`)._

The MVP web app is functionally complete. What's left is testing and minor bug
polish.

## Backend — 100% of MVP scope

All endpoints implemented, wired up, no stubs.

| Endpoint | Status |
|---|---|
| `GET /health` | Done |
| `POST /auth/me` | Done — Firebase verify + user upsert |
| `GET /categories` | Done |
| `GET /questions` | Done — filtered, paginated, no answer |
| `GET /browse/questions` | Done — same + type filter, reveals answers |
| `GET /questions/{id}` | Done — full detail |
| `POST /study/sessions` | Done — validates category |
| `GET /study/sessions/{id}/next` | Done — due SRS → unseen → 404 |
| `POST /study/sessions/{id}/answer` | Done — SM-2 + answer logged |
| `POST /study/sessions/{id}/end` | Done — 204 |
| `GET /users/me/stats` | Done — due/studied/streak/total/weak |
| `GET/PATCH /users/me/preferences` | Done — JSONB preferences (`show_options`) |

Data: `data/final_questions.json` holds 4500 compiled questions ready to load.

## Frontend — essentially complete

| Feature | Status |
|---|---|
| Firebase auth (email/password + Google) | Done |
| Protected routes | Done |
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

1. **Testing** — no automated test suite yet (no `tests/` dir, no pytest/vitest
   config present). Primary remaining effort. Cover at minimum: SM-2
   (`services/srs.py`), next-question selection staging, stats aggregation
   (streak + weak categories), and the study-flow hook.
2. **Minor bug fixes** — see below.

## Known issues (`dev/ISSUES.md`)

1. **FIXED** — Tab refocus re-requested questions/categories and scrambled
   answers. Resolved via `refetchOnWindowFocus: false` on the QueryClient
   (`App.tsx`).
2. **PARTIALLY FIXED** — Flash of the *next* question's answer for a brief moment
   when flipping back to the question side. Mitigated by batching
   `setCurrentQuestion` + `setIsFlipped(false)` in `useStudySession.fetchNext`.
   May still warrant a closer look on slow renders.
3. **OPEN** — Browse pagination uses `limit`/`offset` under the hood. Desired:
   proper page-number pagination with `?page=n` in the URL so the user can jump
   to any page. Frontend `BrowsePage` uses MUI `Pagination` with `PAGE_SIZE=50`;
   the URL-driven `?page=n` deep-linking is the outstanding piece.

## Recently shipped (git history)

- Clickable options on flashcard for multiple/boolean questions.
- FlashCard flip no longer flashes the answer during flip.
- `useStudySession` flip-state management corrected.
- Browse page recreated with pagination groundwork.
- Planning docs: data sourcing, monetization, Android port plan.
</content>
