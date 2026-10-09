# Status — Done / Remaining / Known Issues

_Last reconciled against the code on 2026-10-09 (branch `main`, commit `88a2fb0`)._

**v1 is feature-complete.** The web app is deployed, works anonymously and
offline, and syncs to an account. What remains for v1 is release hardening
(testing, lint cleanup, a content/licensing check); everything else is
post-v1 — see [ROADMAP.md](ROADMAP.md).

## v1 feature set

| Feature | Status |
|---|---|
| Anonymous-first auth (lazy anon uid; email/Google account **linking**) | Done |
| Local SQLite store + offline study engine (`src/local/`) | Done |
| Question bundle bootstrap gate + background refresh with tombstones | Done |
| Sync engine (mirror push/pull + full restore: events, progress, authored Qs, flags, prefs) + toast | Done |
| AppShell + BottomNav (Nauka / Pytania / Menu) | Done |
| Study flow (Setup → FlashCard → Rating → Complete), SM-2 on device | Done |
| Study scope: **source(s) + categories** picker, new / review / mixed modes | Done |
| Clickable options on flashcard for multiple/boolean | Done |
| **Answer timer** (optional, 1–120 s, auto-flips on timeout — "1 z 10" pressure) | Done |
| Browse: **all-sources category search** + difficulty/type filters on `/browse` | Done |
| Browse per source (`/browse/:source`) with filters + `?page=n` pagination | Done |
| Stats (StatCards + WeakCategoriesChart + DailyActivityChart) | Done |
| User submissions (AddQuestionPage + MojePytaniaPage, private/public) | Done |
| Question reporting ("zgłoś błąd" → local flags → sync) | Done |
| MenuPage settings (display name, sign-out, `show_options`, `daily_limit`, timer) | Done |
| ErrorBoundary | Done |

## Deployment

| Piece | Where | State (checked 2026-10-09) |
|---|---|---|
| Web app | Firebase Hosting, project `pub-quizowanie` | responding |
| API | Cloud Run, `europe-west4` (URL in `frontend/.env.production`) | `/health` → ok |
| Database | Neon Postgres | migration head `c9d8e7f6a5b4` |
| Android | Capacitor config only — `android/` not generated yet | post-v1 |

## History of the main milestones

### Browse search, source selection, timer (2026-06-19)
- `/browse` gained a category Autocomplete spanning **all sources** plus the
  difficulty/type toggles; results show a source chip. State lives in URL
  query params (`?category=&type=&difficulty=&page=`). The question card was
  extracted to `components/QuestionCard.tsx` and is shared with
  `SourceQuestionsPage`.
- The study picker (`CategoryPickerModal`) selects **sources first**, then
  narrows categories to those with questions in the chosen sources. The
  session carries `sources` down to `getNextLocalQuestion`.
- Optional per-question **answer timer** (preferences `timer_enabled`,
  `timer_seconds`, default 5 s): a draining bar on the card, auto-flip to the
  answer on timeout.

### User submissions + reporting (2026-06-18)
- Author open / ABCD / boolean questions, private or public. Backend gained
  `submitted_by` + `is_public` (migration `b8c7d6e5f4a3`) and the
  `user_submission` source; `/sync` mirrors authored questions both ways
  (insert-only, immutable by id).
- "Zgłoś błąd" reports → local + server `question_flags` (migration
  `c9d8e7f6a5b4`), pushed write-only via `/sync`, deduped by `client_id`.
- Daily-activity tracking + charts over the local `answer_events` log.

### Backend cleanup + mirror sync (2026-06-12)
Backend cut to 3 routes (`/health`, `/bundles/latest`, `/sync`); SM-2 lives
only in the frontend; `/sync` became a verbatim mirror (event union, progress
LWW, prefs). Verified end-to-end by `backend/scripts/verify_sync.py`.

### Local-first refactor (2026-06-11)
On-device SQLite became the source of truth; anonymous use with no login
wall; registration links onto the anonymous uid.

## Remaining before / around the v1 release

1. **Testing** — vitest covers only the SM-2 fixture (`src/local/srs.test.ts`,
   2 tests). Missing: next-question staging (incl. the source filter), local
   stats aggregation (streak, weak categories, daily activity), the study-flow
   hook (incl. timer), and a real pytest suite (promote
   `scripts/verify_sync.py`, pointed at a non-shared Postgres).
2. **Manual / real-device pass** of the local-first flows: first run, offline
   study, registration sync, multi-device merge, delete-app-and-restore.
3. **Lint** — 7 `react-hooks` v7 errors (`useStudySession` refs pattern,
   `CategoryPickerModal`, `AuthContext` fast-refresh). Build and tests are green.
4. **Bundle size** — Vite warns the main chunk is > 500 kB; consider
   route-level code splitting.
5. **Content licensing** — the pool is translated OpenTDB (CC BY-SA 4.0);
   confirm attribution is shown in the app before a public launch.
6. **Moderation is manual** — public submissions (`verification_status`) and
   flags (`question_flags.status`) are changed directly in the DB.

## Known issues / notes

- Branding is mixed: the app shell/title says **quizMinds**
  (`index.html`, `capacitor.config.ts`), the repo/API say **Quizowanie**.
- The backend Dockerfile builds on Python 3.12; local dev uses 3.14.
- Previously tracked UI bugs (`dev/ISSUES.md`: refocus refetch reshuffle,
  flip-flash, browse pagination) are all fixed.
