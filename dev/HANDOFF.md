# Handoff Document

**Date**: 2026-06-08  
**Branch**: `feature`

---

## Project Overview

Quizowanie is a Polish-language flashcard / spaced-repetition training platform for competitive quiz show players (*1 z 10*, *Milionerzy*, *PubQuiz*). Stack: FastAPI + async SQLAlchemy + Neon Postgres on the backend; React 19 + TypeScript + MUI + TanStack Query + Firebase Auth on the frontend.

Full planning docs live in `dev/`. Start there for architecture decisions. `dev/STUDY_PIPELINE.md` is a detailed write-up of the SM-2 study flow.

---

## What Is Fully Done

### Backend — 100% complete for MVP scope

All endpoints are implemented, tested, and wired up. No stubs remain.

| Endpoint | Status |
|---|---|
| `GET /health` | Done |
| `POST /auth/me` | Done — Firebase token verify, upsert user |
| `GET /categories` | Done — flat list, auth-protected |
| `GET /questions` | Done — paginated, filtered (category, source, difficulty) |
| `GET /browse/questions` | Done — same filters + type filter, reveals answers |
| `GET /questions/{id}` | Done — full detail including answer |
| `POST /study/sessions` | Done — creates session, validates category |
| `GET /study/sessions/{id}/next` | Done — due SRS first, then unseen, 404 when exhausted |
| `POST /study/sessions/{id}/answer` | Done — SM-2 applied, StudyAnswer logged |
| `POST /study/sessions/{id}/end` | Done — sets ended_at, 204 |
| `GET /users/me/stats` | Done — due_today, total_studied, streak_days, total_questions, weak_categories |

Key backend notes:
- `GET /study/sessions/{id}/next` returns `QuestionResponse` — **intentionally withholds the answer**. The answer is only in `QuestionDetail` (`GET /questions/{id}`) or in the `SubmitAnswerResponse` from `POST .../answer`.
- SM-2 lives in `backend/app/services/srs.py`. Quality scale is 0, 3, 4, 5 (1 and 2 are skipped per SM-2 convention).
- Weak categories require a minimum of **5 answers** per category before surfacing, and return the **bottom 5** by average quality.
- `asyncio.gather` is used in `services/stats.py` to run all five stat queries in parallel.
- Neon + asyncpg SSL fix: `sslmode` / `channel_binding` must be stripped from `DATABASE_URL`; use `connect_args={"ssl": True}` instead. See `backend/app/database.py`.

### Frontend — mostly complete

| Feature | Status |
|---|---|
| Firebase auth (email/password + Google) | Done |
| Protected routes | Done |
| AppShell + responsive sidebar | Done |
| Study flow (SessionSetup → FlashCard → RatingButtons → SessionComplete) | Done |
| Browse page (filters, pagination, answer visualization) | Done |
| All API clients (`src/api/`) | Done |
| All TypeScript types (`src/types/api.ts`) | Done |
| All data-fetching hooks | Done |
| StatsPage | **Stub only** — single Typography heading |
| SettingsPage | **Stub only** — single Typography heading |
| ErrorBoundary component | Missing |

---

## Bug Fixed This Session

### FlashCard showed no answer on flip

**Root cause**: `GET /study/sessions/{id}/next` returns `QuestionResponse` (no `answer`, `explanation`, `mnemonic`). The hook stored this as the current question and `FlashCard` rendered `question.answer` → `undefined`.

**Fix applied**:
- `hooks/useStudySession.ts` — `fetchNext` now chains two calls: `getNextQuestion` (gets brief + ID) → `getQuestion(brief.id)` (gets full `QuestionDetail` with answer).
- `currentQuestion` state type changed from the removed `Question` to `QuestionDetail`.
- `components/flashcard/FlashCard.tsx` — prop type changed from `Question` to `QuestionDetail`.
- `api/study.ts` — `getNextQuestion` return type changed from `Question | null` to `BrowseQuestion | null`.
- `types/api.ts` — legacy `Question` interface removed (it never matched any real backend response).

---

## What Remains: Frontend Implementation Plan

### 1. StatsPage — main remaining work

**File**: `src/pages/StatsPage.tsx`

Everything it needs already exists — no new hooks or API clients required.

**Data source**: `useUserStats()` hook → `GET /users/me/stats` → returns `UserStats`:
```typescript
interface UserStats {
  due_today: number;
  total_studied: number;
  streak_days: number;
  total_questions: number;
  weak_categories: WeakCategory[];   // bottom 5 by avg quality, min 5 answers each
}

interface WeakCategory {
  category_id: string;
  category_name: string;
  avg_quality: number;   // 0.0–5.0, rounded to 2 decimal places
}
```

**Layout** (per `dev/FRONTEND_MVP_PLAN.md`):

Top row — four `StatCard` components side by side (wrap on mobile):
- **Dzisiaj do powtórki** → `stats.due_today`
- **Pytań poznanych** → `stats.total_studied`
- **Seria dni** → `stats.streak_days` (with a flame or streak icon)
- **Pytań w bazie** → `stats.total_questions`

Below — bar chart of weak categories using `@mui/x-charts` `BarChart` (already in `package.json`, no extra install needed). X-axis = category names, Y-axis = avg quality (0–5). Show an empty state message if `weak_categories` is empty.

**`StatCard` component** — create at `src/components/stats/StatCard.tsx`. Props: `label: string`, `value: number | string`, `icon?: ReactNode`. Use MUI `Card` + `CardContent`. Reusable, no business logic.

**`WeakCategoriesChart` component** — create at `src/components/stats/WeakCategoriesChart.tsx`. Receives `categories: WeakCategory[]`. If empty: show `Typography` "Brak danych — odpowiedz na więcej pytań". Otherwise render `BarChart` from `@mui/x-charts`.

Handle loading state (show skeletons or spinner) and error state (show MUI `Alert`).

---

### 2. SettingsPage — small

**File**: `src/pages/SettingsPage.tsx`

MVP scope only (per plan): display name editable field + sign-out button.

Firebase `currentUser.displayName` is the display name. Update via `updateProfile(auth.currentUser, { displayName })` from `firebase/auth`. No backend call needed — display name is Firebase-only for MVP.

Components needed: MUI `TextField` (controlled, with Save button), MUI `Button` for sign-out (calls `signOut(auth)` from `firebase/auth`, redirects to `/login`).

No new hooks needed — use `useAuth()` for the current user and call Firebase directly in the component.

---

### 3. ErrorBoundary — small

**File**: `src/components/common/ErrorBoundary.tsx`

Referenced in the plan but not created. Standard React class component wrapping `componentDidCatch`. Show a fallback MUI `Alert` with a "Odśwież stronę" reload button. Wrap the `<Outlet />` in `AppShell.tsx` with it.

---

## Key Patterns to Follow

**API clients** (`src/api/`): plain async functions returning typed promises. No classes. One file per resource.

**Hooks** (`src/hooks/`): TanStack Query (`useQuery` / `useMutation`) wrappers over API functions. Business logic (e.g. `useStudySession`) is also here, not in pages.

**Pages** (`src/pages/`): thin — just compose hooks and components. No direct API calls.

**Types** (`src/types/api.ts`): single source of truth for all API response shapes. No `any`. All types are plain interfaces / type aliases.

**Theme**: `src/theme.ts` is the single source of truth. Dark mode. Inter font. Do not add inline `sx` colors that bypass the palette.

**Polish UI**: all user-facing strings are Polish. No i18n library — hard-coded.

**Auth**: `useAuth()` from `src/contexts/AuthContext.tsx` returns `{ user: FirebaseUser | null, loading: boolean }`. `ProtectedRoute` redirects to `/login` if no user.
