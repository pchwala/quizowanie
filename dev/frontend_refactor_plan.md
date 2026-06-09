# Frontend Refactor Plan — Mobile-First Dark UI

## Context

The current frontend uses a desktop-style MUI sidebar layout. The goal is to replace it entirely with a mobile-first dark UI matching the "reword" app reference screenshots: bottom tab navigation, dark rounded cards, row-based menus. The refactor covers 3 screens (Nauka, Pytania, Menu) plus the category picker modal. The existing flashcard session (flip card + rating buttons) is **not** changed.

---

## Route Structure (new)

| Route | Component | Notes |
|---|---|---|
| `/` | redirect → `/nauka` | |
| `/nauka` | `NaukaPage` | New home screen (was study setup) |
| `/nauka/session` | `StudySessionPage` | Existing flashcard logic, moved here |
| `/pytania` | `PytaniaPage` | Source list (replaces BrowsePage) |
| `/pytania/:source` | `SourceQuestionsPage` | Drills into one source |
| `/menu` | `MenuPage` | Replaces SettingsPage |
| `/login` | `LoginPage` | Unchanged |

Bottom nav is hidden inside `/nauka/session` and `/pytania/:source` (sub-routes). All other protected routes show the bottom nav.

---

## 1. Theme (`theme.ts`)

Update MUI theme colours to match reference:
- `background.default`: `#0e0e0e`
- `background.paper`: `#1c1c1e` (cards)
- `primary.main`: `#4f6ef7` (blue accent, matches reference)
- `text.primary`: `#ffffff`
- `text.secondary`: `#8e8e93`
- `divider`: `rgba(255,255,255,0.08)`
- Border radius on Paper: `16px`

---

## 2. Layout — remove sidebar, add bottom nav

**Delete:** `AppShell.tsx`, `Sidebar.tsx`, `NavItem.tsx`, `UserAvatarSection.tsx`

**Create:** `components/layout/AppShell.tsx` (new, minimal)
- Renders `<Outlet />` in a scrollable content area with `paddingBottom: 64px` (nav bar height)
- Renders `<BottomNav />` fixed at bottom
- No AppBar, no sidebar

**Create:** `components/layout/BottomNav.tsx`
- 3 tabs: **Nauka** (school/book icon), **Pytania** (list icon), **Menu** (settings icon)
- Active tab highlighted in `primary.main` blue
- Inactive tabs in `text.secondary` grey
- Uses `useLocation` + `useNavigate` from react-router to highlight active tab and navigate

---

## 3. NaukaPage (`pages/NaukaPage.tsx`)

Scrollable page. Sections from top to bottom:

### Header
- Centered app name "**quizowanie**" — first letter or prefix in `primary.main`

### Section: "Powtarzanie z przerwami"
Dark rounded `Paper` card, rows separated by `Divider`:

1. **Category row** — `EditIcon` + `"{n} kategorii wybranych"` + category chip(s) on right → opens `CategoryPickerModal`
2. **New questions row** — `AddCircleOutlineIcon` (pink/accent) + `"Ucz się nowych pytań"` + subtitle `"Nauczyłeś się dziś: {learnedToday} z {dailyLimit}"` → `navigate('/nauka/session?mode=new')`
3. **Review row** — `HistoryIcon` (yellow/amber) + `"Powtórz pytania"` + subtitle `"Pytań do powtórki: {dueCount}"` → `navigate('/nauka/session?mode=review')`

Data sources: `useUserPreferences` (dailyLimit), `useUserStats` (dueCount, learnedToday — may need new backend field or approximate from existing stats).

### Section: "Statystyki"
Dark rounded `Paper` card:
- **Day-of-week row**: 7 circles (Pn Wt Śr Cz Pt Sb N), current day indicated by small triangle below
- **Today's progress**: `"Pytania dziś: {n}/{dailyLimit}"` with a simple circular progress indicator — placeholder for now (shows 0/dailyLimit)
- **Weak categories**: reuse `WeakCategoriesChart` component, displayed below

---

## 4. StudySessionPage (`pages/StudySessionPage.tsx`)

Move all logic from current `StudyPage.tsx` here. Accept `?mode=new|review` query param to pre-filter session (pass to `useStudySession` if the hook supports it, otherwise ignore for now — it's a later task). The flashcard view itself (`FlashCard`, `RatingButtons`, `SessionProgress`, `SessionComplete`, `SessionSetup`) is **unchanged**.

---

## 5. PytaniaPage (`pages/PytaniaPage.tsx`)

### Header
- Left-aligned `"Pytania"` title (large, bold)
- Search bar below (dark rounded input, magnifier icon)

### Source list
Dark rounded `Paper` card, rows separated by `Divider`:

Sources to list (hardcoded for now, matching existing `source` field values in the API):
- `opentdb` — "OpenTDB" + question count
- `1z10_archive` — "1 z 10" + question count
- `milionerzy_archive` — "Milionerzy" + question count
- `pubquiz_archive` — "PubQuiz" + question count
- `user_submission` — "Pytania użytkowników" + question count
- `ai_generated` — "AI" + question count

Right side: question count (grey). No mastery % yet (placeholder empty).

Each row tappable → `navigate('/pytania/:source')`.

Data: call `GET /questions?limit=0` per source or use `useCategories` — check what's available. If no endpoint for counts, show counts as placeholders ("—").

### Source row
Simple emoji or MUI icon per source (can iterate icons later).

---

## 6. SourceQuestionsPage (`pages/SourceQuestionsPage.tsx`)

- Back arrow in header + source name as title
- Reuse existing browse/filter/pagination logic from `BrowsePage.tsx` but pre-filtered by `source = :source` param
- Search, category filter, difficulty filter — same as current `BrowsePage`
- Bottom nav hidden on this route

---

## 7. MenuPage (`pages/MenuPage.tsx`)

`"Menu"` title at top.

Sections (dark rounded cards):

**Card 1 — User**
- Avatar + display name + email

**Card 2 — Ustawienia** (single row, taps to expand or navigate to sub-section inline)
Settings fields shown directly (no sub-navigation needed):
- Display name text input
- `"Pokaż odpowiedzi"` toggle switch (`show_options` in `useUserPreferences`)
- `"Pytania dziennie"` number input (new preference field `daily_limit`, default 15)

Existing `useUserPreferences` hook saves to backend — add `daily_limit` field there.

**Card 3 — Placeholders** (greyed out, non-interactive):
- Statystyki (placeholder)
- O aplikacji (placeholder)

---

## 8. CategoryPickerModal (`components/study/CategoryPickerModal.tsx`)

- MUI `Dialog` fullWidth, `maxWidth="sm"`, slides up from bottom (`TransitionComponent={Slide}`)
- Header: `"Wybierz kategorie"` + close button
- Body: list of all categories from `useCategories()`, each row has checkbox
- Footer: `"Zatwierdź"` primary button
- State: local to `NaukaPage`, persisted in Zustand or localStorage (array of selected category IDs)

Reuses `useCategories` hook — no new API calls.

---

## 9. Files to delete

- `components/layout/Sidebar.tsx`
- `components/layout/UserAvatarSection.tsx`  
- `components/layout/NavItem.tsx`
- `pages/SettingsPage.tsx` (replaced by MenuPage)
- `pages/BrowsePage.tsx` (replaced by PytaniaPage + SourceQuestionsPage)

---

## 10. App.tsx routing update

```
/login          → LoginPage (public)
/nauka          → NaukaPage (protected, shows BottomNav)
/nauka/session  → StudySessionPage (protected, no BottomNav)
/pytania        → PytaniaPage (protected, shows BottomNav)
/pytania/:source→ SourceQuestionsPage (protected, no BottomNav)
/menu           → MenuPage (protected, shows BottomNav)
/               → redirect to /nauka
```

---

## Verification

1. `cd frontend && npm run dev` — app starts without errors
2. Navigate all 3 bottom tabs: Nauka / Pytania / Menu render correctly
3. On Nauka page: category picker modal opens, closes, selected count updates in the row
4. Tapping "Ucz się nowych pytań" navigates to flashcard session; back button returns to Nauka
5. On Pytania page: source rows visible; tapping one navigates to filtered question list
6. On Menu page: display name and daily limit inputs save without error
7. Test on narrow viewport (375px) — no horizontal overflow, bottom nav always visible

---

## Implementation order

1. `theme.ts` — colours only
2. New `AppShell.tsx` + `BottomNav.tsx` + update `App.tsx` routes
3. `NaukaPage.tsx` (static first, then wire data)
4. `CategoryPickerModal.tsx`
5. `StudySessionPage.tsx` (move logic from StudyPage)
6. `PytaniaPage.tsx`
7. `SourceQuestionsPage.tsx`
8. `MenuPage.tsx`
9. Delete old files
