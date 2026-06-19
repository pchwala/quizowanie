# Frontend Reference

React 19 + TypeScript (strict) SPA built with Vite, wrapped by Capacitor for
Android. MUI v9, TanStack Query v5, Zustand, Firebase Auth, Axios, Capacitor
SQLite. Dark theme, Polish UI. **Local-first**: all reads/writes go to
on-device SQLite; the API is only used for the question bundle and sync.

## Project layout

```
frontend/
  capacitor.config.ts       # Capacitor app id/name; webDir dist
  vite.config.ts            # base './' (WebView file:// loads), jeep-sqlite excluded from prebundle
  public/assets/sql-wasm.wasm  # jeep-sqlite web fallback (copied from sql.js)
  src/
    main.tsx                # React root + jeep-sqlite element registration (web only)
    App.tsx                 # QueryClient + AuthProvider + ThemeProvider + Router
    theme.ts                # MUI theme — single source of truth (dark, Inter)
    firebase.ts             # Firebase app init + auth export
    contexts/
      AuthContext.tsx       # useAuth() → { user, loading, isAnonymous }
                            #   lazy signInAnonymously() when online; installs sync triggers
    api/
      client.ts             # Axios instance + Bearer-token interceptor (bundle + sync only)
    local/                  # ── the on-device data layer (source of truth) ──
      db.ts                 # platform-aware SQLite connection + schema + query/run/meta helpers
      srs.ts                # SM-2 — the ONLY implementation (server stores verbatim)
      srs.test.ts           # frozen reference fixture for the schedule (npm test)
      nextQuestion.ts       # due-SRS → unseen staging
      options.ts            # shuffled options builder
      questions.ts          # row mapper + local browse/category queries
      stats.ts              # due/studied/streak/weak-categories/daily-activity over local tables
      engine.ts             # session orchestration: start/getNext/submitAnswer
      bundle.ts             # first-run fetch + background refresh of /bundles/latest
      identity.ts           # offline device_id + local preferences (meta table)
      userQuestions.ts      # author/list user-submitted questions in the local store
      flags.ts              # queue "zgłoś błąd" reports in local question_flags
    sync/
      syncEngine.ts         # POST /sync mirror: push events+progress+authored+flags+prefs, pull missing
    hooks/
      useStudySession.ts    # study-flow state machine → local/engine
      useNewLearnedToday.ts # "Poznane dziś" derived from answer_events (sync-proof)
      useCreateQuestion.ts  # submit a user-authored question (→ local/userQuestions)
      useUserQuestions.ts   # list the user's own authored questions + status
      useReportQuestion.ts  # file a question report (→ local/flags)
      useDailyActivity.ts   # learned-vs-reviewed per day for the activity chart
      useCategories.ts | useQuestions.ts | useUserStats.ts | useUserPreferences.ts
                            # TanStack Query wrappers over local/*
    store/
      ui.ts                 # Zustand: UI state
    components/
      ReportQuestionDialog  # "zgłoś błąd" dialog (reason select + optional detail)
      common/   ProtectedRoute (bundle bootstrap gate), RegisterCta, SyncToast,
                LoadingScreen, ErrorBoundary
      layout/   AppShell (+ SyncToast), BottomNav (3 tabs: Nauka / Pytania / Menu)
      flashcard/ FlashCard, RatingButtons, SessionProgress
      study/    SessionSetup, CategoryPickerModal, SessionComplete
      stats/    StatCard, WeakCategoriesChart, DailyActivityChart (@mui/x-charts)
    pages/
      LoginPage (register/link screen), NaukaPage, StudySessionPage,
      PytaniaPage, SourceQuestionsPage, AddQuestionPage, MojePytaniaPage, MenuPage
    types/
      api.ts                # all shared data shapes (single source of truth)
```

## Routing & bootstrap (App.tsx)

```
/login            → LoginPage (register/link — reached from CTA or Menu)
/  (gated)        → AppShell with <Outlet>:
   index          → redirect to /study
   /study         → NaukaPage          /study/session  → StudySessionPage
   /browse        → PytaniaPage        /browse/:source → SourceQuestionsPage
   /questions/new → AddQuestionPage    /questions/mine → MojePytaniaPage
   /menu          → MenuPage
```

**There is no login wall.** `ProtectedRoute` is a bundle-bootstrap gate: on
first run it blocks on the `/bundles/latest` download (spinner → offline-retry
screen if no network); on later runs it renders immediately and refreshes the
bundle in the background (invalidating queries if the pool moved).

`useAuth()` returns `{ user, loading, isAnonymous }`. `AuthContext` signs in
anonymously (lazily, retried on reconnect) — study never waits for it; the
identity only enables sync.

## Local store

Tables in `local/db.ts` (SQLite): `questions` (bundle rows **plus** the user's
own authored questions — extra columns `is_user_owned`, `is_public`,
`verification_status`), `categories`, `progress` (SM-2 state, PK question_id),
`answer_events` (append-only log: `event_id` UUID PK, quality, answered_at, mode,
`synced` flag), `question_flags` (queued "zgłoś błąd" reports with a `synced`
flag), `meta` (key/value: device_id, bundle_version, last_sync_at, sync_cursor,
preferences JSON). A lightweight migration in `db.ts` adds the authored-question
columns to an existing `questions` table when missing.

On web the store persists to IndexedDB via `jeep-sqlite` (autoSave +
explicit `persistWebStore()` after writes). Native Android uses the real
plugin — same code path through `getDb()`.

## Study flow (the core)

`useStudySession.ts` drives the same state machine as before, but against
`local/engine.ts` — sessions are **in-memory**; the durable record is the
`progress` upsert + `answer_events` append per answer:

```
startSession(categoryIds?, mode)
  └ startLocalSession() (no API)
  └ fetchNext: getNextForSession() → full QuestionDetail from SQLite
      (the old /next + detail two-call pattern collapsed — answer is local)

user flips (Space / tap) or picks an option → isFlipped=true
user rates Źle/Dobrze/Łatwe (quality 0/3/5):
  submitLocalAnswer → applySm2 + progress upsert + answer_events append
  fetchNext (loops; null → complete)
endSession → reset, invalidate ['userStats'], void syncNow()
```

**Flip-flash fix** (unchanged): `setCurrentQuestion` + `setIsFlipped(false)`
are batched in `fetchNext`.

**Keyboard shortcuts** (unchanged): pre-flip `1–4` select option / `Space`
flips; post-flip `1/2/3` → quality `0/3/5`.

**Daily progress** (`hooks/useNewLearnedToday.ts`): `Poznane dziś: n z
{daily_limit}` counts distinct questions whose **first-ever** answer is today,
straight from the local `answer_events` log — so it survives reinstalls and
includes study synced from other devices. Invalidated per answer and on
`SYNC_DONE_EVENT`.

## Sync

`sync/syncEngine.ts` — `syncNow()` runs one mirror cycle against `POST /sync`:

- **Push**: unsynced `answer_events`, the **entire** local `progress` table,
  not-yet-pushed authored questions, queued `question_flags`, and raw
  `meta.preferences` (`null` = never set locally, so a fresh device can't clobber
  server prefs with defaults), plus the `sync_cursor` meta.
- **Pull**: events this device is missing (`server_seq > cursor` — inserted
  with `INSERT OR IGNORE`, `synced=1`; rebuilds full history/streak/stats on a
  fresh device), all server progress rows applied **last-write-wins by
  `last_reviewed_at`** (only newer server rows overwrite local), all of the
  user's authored questions (restores own content + current `verification_status`),
  preferences (only when locally unset), then the new cursor is persisted. Flags
  are write-only — never returned.

This makes the first sync after login a **full restore** — delete the app,
come back later, log in, everything returns. Triggers: reconnect (`online` +
`@capacitor/network`), tab refocus, session end, identity attach,
registration. Anonymous users skip the call when nothing to push. `SyncToast`
(in `AppShell`) listens for `SYNC_DONE_EVENT` and shows „Zsynchronizowano X
odpowiedzi” (X = pushed + pulled).

## Account UX

- **RegisterCta** — dismissible banner on NaukaPage for anonymous users
  („Zarejestruj się, aby zapisać postępy…”), dismissal in localStorage.
- **MenuPage** — guest card („Gość / Postępy zapisane tylko na tym urządzeniu”)
  + „Załóż konto lub zaloguj się” entry; display-name field and sign-out only
  for registered users. Sign-out returns to `/` (a fresh anon identity attaches).
- **LoginPage** — defaults to register mode. Anonymous + register →
  `linkWithCredential`/`linkWithPopup` (uid preserved, server data carries
  over); Google account already in use → fallback `signInWithPopup` and the
  event-log union merges on sync. Finishes with `syncNow()`.

## Pages

- **NaukaPage** — study home: RegisterCta, category picker, new/review entry
  rows, streak/total stats, weak-categories chart. All from local store.
- **StudySessionPage** — the active flashcard loop.
- **PytaniaPage / SourceQuestionsPage** — browse, filtered + paginated via
  `browseLocalQuestions` (no network).
- **MenuPage** — account card, settings (`show_options`, `daily_limit` — stored
  in local `meta`), register/sign-out, links to add/your-own questions.
- **AddQuestionPage** (`/questions/new`) — author a question (open / ABCD /
  boolean), pick a category, choose private vs public. The client generates the
  UUID and writes it to the local `questions` table (`is_user_owned=1`); `/sync`
  mirrors it to the account. Private questions stay on the author's account;
  public ones enter the shared moderation queue.
- **MojePytaniaPage** (`/questions/mine`) — lists the user's own authored
  questions with a `verification_status` chip (pending / verified / rejected),
  via `useUserQuestions`.

## User submissions & reporting

- **Authoring** (`local/userQuestions.ts`, `useCreateQuestion`): a submitted
  question is **permanent local content** — the author keeps their local copy
  even if it is later rejected. The local row and the server row share one
  client-generated id, so sync upserts never duplicate it.
- **Reporting** (`ReportQuestionDialog`, `local/flags.ts`, `useReportQuestion`):
  "zgłoś błąd" with a reason (`wrong_answer` / `typo` / `inappropriate` /
  `duplicate` / `other`) + optional detail. Reports queue in the local
  `question_flags` table and are pushed (write-only) on the next sync; there is
  no admin/moderation UI yet.

## Conventions

- **Pages are thin** — compose hooks + components, no direct API/DB calls.
- **Business logic lives in hooks and `local/`**, not pages.
- **All user-facing strings Polish**, hard-coded (no i18n).
- **Theme is centralized** — don't bypass the palette with inline `sx` colors.
- **SM-2 is frozen**: `local/srs.ts` is the only implementation; its fixture
  in `local/srs.test.ts` is the reference spec. A failing fixture means every
  user's schedule changes — only change it deliberately and regenerate.
- `npm test` runs vitest (currently the SRS fixture suite).
