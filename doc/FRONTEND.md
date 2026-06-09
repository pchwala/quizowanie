# Frontend Reference

React 19 + TypeScript (strict) SPA built with Vite. MUI v9, TanStack Query v5,
Zustand, Firebase Auth, Axios. Dark theme, Polish UI.

## Project layout

```
frontend/src/
  main.tsx                  # React root
  App.tsx                   # QueryClient + AuthProvider + ThemeProvider + Router
  theme.ts                  # MUI theme — single source of truth (dark, Inter)
  firebase.ts               # Firebase app init + auth export
  index.css
  contexts/
    AuthContext.tsx         # useAuth() → { user, loading } via onAuthStateChanged
  api/
    client.ts               # Axios instance + Bearer-token request interceptor
    categories.ts | questions.ts | study.ts | users.ts
  hooks/
    useCategories.ts        # TanStack Query wrappers
    useQuestions.ts         # incl. useBrowseQuestions
    useUserStats.ts
    useUserPreferences.ts
    useStudySession.ts      # study-flow state machine (the meaty one)
  store/
    ui.ts                   # Zustand: sidebar/UI state
  components/
    common/   ProtectedRoute, LoadingScreen, ErrorBoundary
    layout/   AppShell, Sidebar, NavItem, UserAvatarSection
    flashcard/ FlashCard, RatingButtons, SessionProgress
    study/    SessionSetup, SessionComplete
    stats/    StatCard, WeakCategoriesChart
  pages/
    LoginPage, StudyPage, BrowsePage, StatsPage, SettingsPage
  types/
    api.ts                  # all API response shapes (single source of truth)
```

## Routing & auth (App.tsx)

```
/login            → LoginPage (public)
/  (protected)    → AppShell with <Outlet>:
   index          → redirect to /study
   /study         → StudyPage
   /browse        → BrowsePage
   /stats         → StatsPage
   /settings      → SettingsPage
```

`ProtectedRoute` wraps `AppShell` and redirects to `/login` when `useAuth()`
returns no user. The QueryClient sets `refetchOnWindowFocus: false` (deliberate —
see [STATUS.md](STATUS.md), fixed bug #1).

`useAuth()` from `contexts/AuthContext.tsx` returns `{ user: FirebaseUser | null,
loading: boolean }`.

## API client pattern

`api/client.ts` is an Axios instance with `baseURL` from `VITE_API_URL`
(default `http://localhost:8000`). A request interceptor attaches
`Authorization: Bearer <getIdToken()>` when a Firebase user is present.

Each `api/*.ts` file exports plain typed async functions (no classes). Hooks in
`hooks/` wrap them with `useQuery`/`useMutation`.

## Types (`types/api.ts`)

- `QuestionSource` = `'1z10_archive' | 'milionerzy_archive' | 'pubquiz_archive' | 'opentdb'`,
  with `SOURCE_LABELS` for display.
- `QuestionType` = `'multiple' | 'boolean' | 'question'`.
- `BrowseQuestion` — no answer (`id, type, text, source, difficulty, category_id, options`).
- `QuestionDetail extends BrowseQuestion` — adds `answer, payload, explanation, mnemonic`.
- `UserStats`, `WeakCategory`, `StudySession`, `UserPreferences { show_options }`.
- `AnswerQuality = 0 | 3 | 4 | 5`.

## Study flow (the core)

`useStudySession.ts` is a hand-rolled state machine (not just a query wrapper).
Two API calls per question because `/next` withholds the answer:

```
startSession(categoryIds?)
  └ POST /study/sessions → session
  └ fetchNext(session.id):
      GET /study/sessions/:id/next  → brief (BrowseQuestion, no answer) OR null→complete
      GET /questions/:id            → QuestionDetail (answer + explanation + mnemonic)
      set currentQuestion, isFlipped=false, selectedOption=null

user flips (Space / tap) or picks an option (multiple/boolean) → isFlipped=true
user rates Again/Hard/Good/Easy:
  submitAnswer(quality)
    └ POST /study/sessions/:id/answer { question_id, quality }
    └ fetchNext(...)  (loops)
endSession → POST /study/sessions/:id/end, reset, invalidate ['userStats']
```

**Why two calls** — `/next` is the question-reveal endpoint and intentionally
omits the answer; the detail fetch gets it. The `POST .../answer` response is
ignored (answer already known from the detail fetch).

**Flip-flash fix**: in `fetchNext`, `setCurrentQuestion(detail)` and
`setIsFlipped(false)` are batched so the back face clears before the new
question's answer can render — no flash of the next answer mid-flip.

**Keyboard shortcuts** (in `useStudySession` effect):
- Before flip: `1–4` select an option (when options shown); `Space` flips otherwise.
- After flip: `1/2/3/4` → quality `0/3/4/5`.

`showOptions` comes from user preferences (`useUserPreferences`) — controls
whether multiple/boolean options are clickable on the card front.

## Pages

- **LoginPage** — Firebase email/password + Google sign-in.
- **StudyPage** — thin; renders `SessionSetup` or the active `FlashCard` loop +
  `SessionProgress` + `RatingButtons`, ending in `SessionComplete`.
- **BrowsePage** — filterable, **paginated** question list (read-only).
  `PAGE_SIZE = 50`; filters: category, type, source, difficulty band
  (Łatwe 1–3 / Średnie 4–6 / Trudne 7–10). Uses `useBrowseQuestions`
  (`GET /browse/questions`). See [STATUS.md](STATUS.md) for the page-number
  pagination follow-up.
- **StatsPage** — four `StatCard`s (due today, total studied, streak, total
  questions) + `WeakCategoriesChart` (`@mui/x-charts` BarChart, empty-state
  message when no data).
- **SettingsPage** — editable Firebase display name + sign-out; `show_options`
  preference toggle.

## Conventions

- **Pages are thin** — compose hooks + components, no direct API calls.
- **Business logic lives in hooks**, not pages (e.g. `useStudySession`).
- **All user-facing strings Polish**, hard-coded (no i18n).
- **Theme is centralized** — don't bypass the palette with inline `sx` colors.
- **`ErrorBoundary`** wraps the routed content; **`LoadingScreen`** for suspense/auth-loading.
</content>
