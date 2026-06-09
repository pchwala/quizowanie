# Session Handoff — 2026-06-09

## What was done this session

Complete frontend refactor from a desktop MUI sidebar layout to a mobile-first dark UI modelled on the "reword" app (screenshots in `dev/new_frontend_example/`).

### New route structure
| Route | Component | Notes |
|---|---|---|
| `/nauka` | `NaukaPage` | Home: category picker, new/review buttons, stats |
| `/nauka/session` | `StudySessionPage` | Flashcard session, auto-starts on mount |
| `/pytania` | `PytaniaPage` | Source list with icons |
| `/pytania/:source` | `SourceQuestionsPage` | Filtered browse with back nav |
| `/menu` | `MenuPage` | Display name, show answers, daily limit |

### New components
- `BottomNav` — 3-tab bottom navigation (hides on sub-routes)
- `CategoryPickerModal` — slide-up Dialog with category checkboxes
- `NaukaPage`, `StudySessionPage`, `PytaniaPage`, `SourceQuestionsPage`, `MenuPage` (all new)

### Deleted
`BrowsePage`, `StatsPage`, `SettingsPage`, `StudyPage`, `Sidebar`, `NavItem`, `UserAvatarSection`

### Theme
`#0e0e0e` background, `#1c1c1e` paper, `#4f6ef7` primary blue, `borderRadius: 16`

---

## Issues to fix next session

### 1. "Powtórz pytania" broken
- The `due_today` count from `useUserStats` is non-zero but the UI shows 0
- Navigating to `/nauka/session` always starts a session regardless (even if nothing is due)
- `StudySessionPage` calls `startSession()` unconditionally in `useEffect` on mount — it should gate on `mode` and ideally only start if there are questions available
- Investigate: does the backend's `/users/me/stats` `due_today` field actually reflect SRS-due questions, or is it something else?

### 2. English URL slugs (replace Polish route paths)
All route paths must use English slugs. Currently using Polish which breaks redirects and is non-standard.

| Current (Polish) | Should be |
|---|---|
| `/nauka` | `/study` |
| `/nauka/session` | `/study/session` |
| `/pytania` | `/browse` |
| `/pytania/:source` | `/browse/:source` |
| `/menu` | `/menu` (fine as-is) |

Update in: `App.tsx`, `BottomNav.tsx`, `NaukaPage.tsx` (navigate calls), `StudySessionPage.tsx` (back nav), `SourceQuestionsPage.tsx` (back nav), `AppShell.tsx` (`useShouldShowNav` path checks)

### 3. Post-login redirect broken (consequence of issue 2)
`App.tsx` redirects `/` → `/nauka` but the login page (and Firebase redirect) probably lands on `/`. After fixing slugs to English, the default redirect must point to `/study`. Verify the full login → redirect → app flow works end to end.

### 4. `daily_limit` not persisted — backend change needed
`UserPreferences` in `types/api.ts` has `daily_limit?: number` but the backend `PATCH /users/me/preferences` ignores it. Steps:
- Add `daily_limit: int = 15` to the backend `UserPreferences` model (Pydantic schema + DB column or user settings store)
- Ensure `GET /users/me/preferences` returns it
- Frontend already sends it via `updatePreferences({ ...preferences, daily_limit: n })` — no frontend change needed once backend is ready
- Until then, the value resets to 15 on page refresh

### 5. Category picker — should be full-screen or full-height
The current `CategoryPickerModal` is a `Dialog` that slides up as a bottom sheet. On mobile it feels cramped for long category lists. Two acceptable solutions:
- **Option A (preferred):** Make the Dialog truly full-screen on mobile using `fullScreen` prop (or `useMediaQuery` + conditional `fullScreen`)
- **Option B:** Keep current sheet but remove the `maxHeight: 75vh` cap so it can grow taller

The user noted the SourceQuestionsPage filter UI (inline dropdowns/toggles) is also acceptable as a reference pattern.

### 6. Flashcard card height — must be dynamic
In `FlashCard.tsx` (at `src/components/flashcard/FlashCard.tsx`) the card has a fixed/min height set via `sx`. Long question text overflows the `Paper` container instead of expanding it.
- Remove any fixed `height` / `minHeight` constraints on the card face `Box`
- Use `minHeight` only if needed for short questions (so the card doesn't collapse), but allow it to grow with content
- Test with a long open-ended question to confirm no overflow

---

## File map (key files touched this session)

```
frontend/src/
  App.tsx                              ← routes (needs English slugs)
  theme.ts                             ← dark mobile palette
  index.css                            ← minimal reset
  types/api.ts                         ← UserPreferences + daily_limit
  hooks/useUserPreferences.ts          ← DEFAULT_PREFERENCES daily_limit: 15
  components/layout/AppShell.tsx       ← minimal shell, BottomNav conditional
  components/layout/BottomNav.tsx      ← NEW: 3-tab bottom nav
  components/study/CategoryPickerModal.tsx ← NEW: slide-up category picker
  pages/NaukaPage.tsx                  ← NEW: home screen
  pages/StudySessionPage.tsx           ← NEW: flashcard session (auto-start)
  pages/PytaniaPage.tsx                ← NEW: source list
  pages/SourceQuestionsPage.tsx        ← NEW: filtered browse
  pages/MenuPage.tsx                   ← NEW: settings/menu
  components/flashcard/FlashCard.tsx   ← needs height fix (untouched this session)
```
