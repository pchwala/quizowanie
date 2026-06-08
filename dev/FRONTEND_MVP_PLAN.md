# Frontend MVP Plan

## Scope

React + TypeScript SPA. Four pages: Study (flashcards), Browse, Statistics, Settings. Deployed to Firebase Hosting. All state derived from the FastAPI backend; no local question storage.

---

## Tech Stack

| Concern | Library |
|---|---|
| UI | MUI v6 (Material UI) |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Client/UI state | Zustand |
| Auth | Firebase Auth SDK |
| HTTP | Axios (with interceptor for Bearer token) |
| Language | TypeScript strict mode |

---

## Project Structure

```
src/
  theme.ts                  # single source of truth for MUI theme
  main.tsx                  # React root, QueryClientProvider, RouterProvider
  App.tsx                   # route definitions + AuthProvider wrapper
  firebase.ts               # Firebase app init + auth export
  api/
    client.ts               # Axios instance + auth interceptor
    categories.ts           # API calls for /categories
    questions.ts            # API calls for /questions
    study.ts                # API calls for /study/sessions/*
    users.ts                # API calls for /users/me/*
  hooks/
    useAuth.ts              # Firebase auth state → user + token
    useCategories.ts        # TanStack Query wrapper
    useStudySession.ts      # session state machine (see below)
  store/
    ui.ts                   # Zustand: sidebar open state, active route
  components/
    layout/
      AppShell.tsx          # top AppBar + responsive sidebar + <Outlet>
      Sidebar.tsx           # nav items, user avatar at bottom
      NavItem.tsx
    flashcard/
      FlashCard.tsx         # flip animation card (question → answer)
      RatingButtons.tsx     # Again / Hard / Good / Easy
      SessionProgress.tsx   # linear progress bar + "X left" count
    study/
      SessionSetup.tsx      # quick-start + optional category picker
      SessionComplete.tsx   # end-of-session summary
    browse/
      QuestionList.tsx
      QuestionFilters.tsx
    stats/
      StatCard.tsx
      WeakCategoriesChart.tsx
    common/
      ProtectedRoute.tsx
      LoadingScreen.tsx
      ErrorBoundary.tsx
  pages/
    LoginPage.tsx
    StudyPage.tsx           # wraps SessionSetup or active FlashCard session
    BrowsePage.tsx
    StatsPage.tsx
    SettingsPage.tsx
```

---

## Theme

All visual tokens live in `src/theme.ts`. Swap the palette here and the entire app updates.

```typescript
// src/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    // Override here later — e.g. primary.main, background.default, etc.
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

export default theme;
```

`main.tsx` wraps the app in `<ThemeProvider theme={theme}>`.

---

## Layout (Mobile-first)

```
┌──────────────────────────────────────────┐
│ [≡]  Quizowanie            [Avatar icon] │  ← AppBar (always visible)
├──────────────────────────────────────────┤
│                                          │
│             <page content>               │
│                                          │
└──────────────────────────────────────────┘
```

On **mobile**: `[≡]` opens a temporary `Drawer` (slides in from left, closes on nav or backdrop click). Avatar icon is top-right in AppBar and opens a small menu (Profile / Sign out).

On **desktop (md+)**: Drawer becomes `variant="permanent"` — always visible, no hamburger. Avatar stays top-right.

Sidebar nav items (in order):
1. Study — `/study`
2. Browse — `/browse`
3. Statistics — `/stats`
4. Settings — `/settings`

User avatar sits at the **bottom** of the sidebar on desktop (as requested), and top-right in the AppBar on mobile (where the sidebar isn't visible).

### AppShell.tsx skeleton

```
<Box sx={{ display: 'flex' }}>
  <AppBar>
    {isMobile && <MenuIconButton onClick={toggleSidebar} />}
    <Logo />
    <UserAvatarMenu />           ← top-right
  </AppBar>

  <Drawer variant={isMobile ? 'temporary' : 'permanent'}>
    <NavItems />
    {!isMobile && <UserAvatarSection />}   ← bottom of sidebar on desktop
  </Drawer>

  <Box component="main">
    <Outlet />
  </Box>
</Box>
```

---

## Auth Flow

```
Firebase Auth SDK
      │
      ▼
useAuth hook (onAuthStateChanged)
      │ user + getIdToken()
      ▼
Axios interceptor (client.ts)
      │ Authorization: Bearer <token>
      ▼
FastAPI
```

`src/api/client.ts` adds the token to every outgoing request via a request interceptor. Token is refreshed automatically by the Firebase SDK; the interceptor calls `getIdToken(/* forceRefresh */ false)` which returns the cached token unless it is about to expire.

`ProtectedRoute.tsx` redirects to `/login` if `useAuth()` returns no user.

---

## Pages & Routes

```
/login                  → LoginPage (public)
/                       → redirect to /study
/study                  → StudyPage (SessionSetup or active session)
/browse                 → BrowsePage
/stats                  → StatsPage
/settings               → SettingsPage
```

---

## Flashcard Study Flow

### Session lifecycle

```
StudyPage mounts
    │
    ├─ no active session → SessionSetup (quick start or category picker)
    │       │ POST /study/sessions
    │       ▼
    └─ active session → FlashCard loop
            │ GET /study/sessions/:id/next  → QuestionResponse (no answer)
            │ GET /questions/:id            → QuestionDetail   (answer + explanation + mnemonic)
            │ (two sequential calls per question)
            ▼
         FlashCard (question side)
            │ user taps card or presses Space
            ▼
         FlashCard (answer side) + explanation + RatingButtons
            │ user taps Again / Hard / Good / Easy
            │ POST /study/sessions/:id/answer  { question_id, quality }
            ▼
         next question OR SessionComplete
```

> **Why two calls?** `GET /study/sessions/:id/next` intentionally withholds the answer (it is the question-reveal endpoint). The answer is only available via `GET /questions/:id` (`QuestionDetail`) or from `POST .../answer` response — but the POST requires a quality rating that the user has not yet given. Fetching the detail immediately after receiving the next question ID is the correct fix.

Quality mapping:
| Button | quality |
|---|---|
| Again | 0 |
| Hard | 3 |
| Good | 4 |
| Easy | 5 |

### FlashCard component

CSS 3D flip animation (no library needed):

```
┌─────────────────────────────┐
│                             │
│   Co jest stolicą Australii?│   ← front (question)
│                             │
└─────────────────────────────┘

         [tap / Space]

┌─────────────────────────────┐
│  Canberra                   │   ← back (answer)
│  ─────────────────          │
│  Dlaczego? Sydney i Melbourne│   ← explanation (always shown)
│  rywalizowały…              │
│  ─────────────────          │
│  Mnemonika: Can-bear-a      │   ← mnemonic if present
└─────────────────────────────┘
[ Again ]  [ Hard ]  [ Good ]  [ Easy ]
```

Explanation and mnemonic are shown immediately after flip (not behind another tap). If either is absent, the section is omitted.

### SessionProgress

A `LinearProgress` bar at the top of the session view with a counter: "12 / 40 questions". This count is the number answered in this session, not the total queue size (which is unknown).

### SessionSetup

```
┌─────────────────────────────┐
│  Dzisiaj do powtórki: 24    │   ← due-today count from /users/me/stats
│                             │
│  [  Zacznij naukę  ]        │   ← quick start, all categories
│                             │
│  ▼ Wybierz kategorie        │   ← expandable section
│    [ ] Historia             │
│    [ ] Geografia            │
│    [ ] Nauka                │
│    [  Start z filtrem  ]    │
└─────────────────────────────┘
```

### useStudySession hook

Encapsulates session state so `StudyPage` stays thin:

```typescript
// returns
{
  session: StudySession | null,
  currentQuestion: QuestionDetail | null,   // QuestionDetail — has answer, explanation, mnemonic
  isFlipped: boolean,
  progress: { answered: number },
  isComplete: boolean,
  startSession: (categoryIds?: string[]) => Promise<void>,
  flipCard: () => void,
  submitAnswer: (quality: 0 | 3 | 4 | 5) => Promise<void>,
  endSession: () => Promise<void>,
}
```

`fetchNext` (internal) chains two calls:
1. `GET /study/sessions/:id/next` → gets the question ID and brief metadata
2. `GET /questions/:id` → gets the full `QuestionDetail` including answer

`currentQuestion` holds `QuestionDetail`. The legacy `Question` type in `api.ts` is unused in the study flow and should be removed.

`submitAnswer` in `api/study.ts` is currently typed `Promise<void>` — keep it that way. The answer is already available from the detail fetch; the POST response (`SubmitAnswerResponse`) can be ignored.

---

## Browse Page

Filterable, paginated question list. Read-only.

Filters (top bar): category (multi-select dropdown), source, difficulty range slider.

Each row shows: question text (truncated), category chip, source chip, difficulty badge. Clicking a row opens a detail drawer (not a new page) showing full question + answer + explanation + mnemonic.

---

## Statistics Page

Cards row (StatCard components):
- Due today
- Total studied
- Current streak (days)
- Total questions in DB

Below: a bar chart of weak categories (bottom 5 by average quality). Use MUI's `@mui/x-charts` BarChart — no extra charting library needed.

---

## Settings Page

For MVP: display name (editable), sign-out button. Theme switching can be added later — the theme file is already wired for it.

---

## API Client Pattern

Each file in `src/api/` exports typed functions (no classes):

```typescript
// src/api/study.ts
export const startSession = (categoryIds?: string[]): Promise<StudySession> =>
  client.post('/study/sessions', { category_id: categoryIds?.[0] ?? null }).then(r => r.data);

export const getNextQuestion = (sessionId: string): Promise<Question | null> =>
  client.get(`/study/sessions/${sessionId}/next`).then(r => r.data);

export const submitAnswer = (sessionId: string, questionId: string, quality: number): Promise<void> =>
  client.post(`/study/sessions/${sessionId}/answer`, { question_id: questionId, quality });
```

TanStack Query hooks in `src/hooks/` wrap these with `useQuery` / `useMutation`.

---

## Known Bugs (to fix)

### FlashCard shows no answer on flip
**Root cause**: `GET /study/sessions/:id/next` returns `QuestionResponse` — no `answer`, `explanation`, or `mnemonic` fields. The frontend `Question` type assumed these fields would be present but they never are. `submitAnswer` in `api/study.ts` is `Promise<void>` so even the `SubmitAnswerResponse.correct_answer` is discarded.

**Fix**:
1. In `useStudySession.fetchNext`, chain `GET /questions/:id` after getting the next question. Set `currentQuestion` to the resulting `QuestionDetail`.
2. Change `currentQuestion` state type from `Question | null` to `QuestionDetail | null`.
3. `FlashCard` prop type changes from `Question` to `QuestionDetail`.
4. Remove the legacy `Question` type from `api.ts` (it was a placeholder that never matched any backend response).

---

## Key Implementation Notes

- **Keyboard shortcut**: Space flips the card. 1/2/3/4 keys map to Again/Hard/Good/Easy after flip. Implemented via `useEffect` + `keydown` listener in `useStudySession`.
- **Strict TypeScript**: `"strict": true` in `tsconfig.json`. All API response shapes defined in `src/types/api.ts`.
- **No category nesting in UI for MVP**: Display categories as a flat list. Nesting can be added later without backend changes.
- **Firebase Hosting rewrites**: `firebase.json` must rewrite all paths to `index.html` so React Router handles client-side navigation.

```json
// firebase.json (relevant part)
{
  "hosting": {
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
