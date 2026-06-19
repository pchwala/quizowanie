# Plan: Lift category search + filters up to BrowsePage; add source selection to study picker

## Context

Two related UX gaps in the question-browsing and study-setup flows:

1. **BrowsePage (`PytaniaPage.tsx`, `/browse`)** currently only lists three hardcoded
   source cards, and its search bar merely filters those source *labels*. There is no way to
   search/browse questions across *all* sources at once — the category dropdown + difficulty +
   type filters only exist one level down, inside each per-source subpage (`/browse/:source`).
   Desired: the user can search categories across all sources and apply the same filters
   directly on the BrowsePage. The per-source subpages stay exactly as they are.

2. **Study setup (`CategoryPickerModal.tsx`)** lets the user pick categories but has no concept
   of *source* — `source` lives only on `questions`, never on `categories`, and the session
   query (`getNextLocalQuestion`) filters by `category_id` only. Desired: in the picker the
   user first selects one or more sources, the category list narrows to categories that have
   questions in those sources, and the started session is constrained to the chosen source(s).

User-confirmed decisions (AskUserQuestion):
- BrowsePage search: **search matches category names → shows a filtered question list spanning
  all sources** (the subpage filter set, but source-agnostic).
- BrowsePage layout: **keep the 3 source cards** and add the search+filter+results view alongside.
- Study picker: **pick source(s) first, then categories** — multi-select both; the category list
  narrows to categories that have questions in the selected source(s).

Approach: reuse existing query plumbing (`browseLocalQuestions` already accepts an optional
`source`; omitting it spans all sources). Extract the question-card UI so BrowsePage and the
subpage share it without changing subpage behavior. Thread an optional `sources` filter through
the study-session chain.

## Workstream A — BrowsePage all-sources category search + filters

### A1. Extract the shared question card — `src/components/QuestionCard.tsx` (new)
Move `AnswerSection`, `QuestionCard`, and the `difficultyLabel`/`difficultyColor`/`TYPE_LABELS`/
`DIFFICULTY_RANGES` helpers out of `SourceQuestionsPage.tsx` into this file. Add an optional
`showSource?: boolean` prop to `QuestionCard`; when true, render an extra source chip
(`SOURCE_LABELS[question.source]`) in the chip row. Default false so the subpage is byte-for-byte
unchanged in behavior.

### A2. `SourceQuestionsPage.tsx` — consume the shared card
Replace the inline `AnswerSection`/`QuestionCard`/helpers with imports from `components/QuestionCard.tsx`.
No `showSource` (stays scoped to one source). Everything else unchanged.

### A3. `PytaniaPage.tsx` — add the all-sources search/filter/results view
- Replace the source-label search `TextField` with an MUI **Autocomplete over category options**
  (`buildCategoryOptions(categories)` from `utils/categories.ts`, fed by `useCategories()`),
  placeholder "Szukaj kategorii…". Selecting an option sets a `categoryId` filter.
- Add the difficulty + type `ToggleButtonGroup`s (same config as the subpage, now from the
  shared module) below the search.
- Keep the existing "Moje pytania / Dodaj nowe pytanie" paper and the three source cards.
- When a filter is active (category selected, or a difficulty/type chosen), render a results
  section below using `useBrowseQuestions({ category_id, type, difficulty_min/max, limit, offset })`
  **with no `source`** (spans all sources) + `Pagination`, mapping each item through the shared
  `QuestionCard` with `showSource`. Reuse `ReportQuestionDialog` for the flag action.
- When no filter is active, just show cards (current behavior).
- **State lives in URL query params via `useSearchParams`** (mirroring `SourceQuestionsPage`):
  `?category=&type=&difficulty=&page=`. Use the same `updateFilter(key, value)` helper pattern
  (set/delete the key, reset `page` to `1`). The Autocomplete value is derived from the
  `category` param; the difficulty/type toggles and pagination read/write their params. This
  makes the filtered view shareable, back-button-friendly, and consistent with the subpage.

## Workstream B — Source selection in the study picker

### B1. Local query helpers — `src/local/questions.ts`
- `getAvailableSources(): Promise<QuestionSource[]>` — `SELECT DISTINCT source FROM questions
  WHERE is_active = 1`, ordered by a stable known order.
- `getCategoryIdsForSources(sources: QuestionSource[]): Promise<Set<string>>` —
  `SELECT DISTINCT category_id FROM questions WHERE is_active = 1 AND source IN (...)`.
  Used to narrow the displayed categories.

### B2. Session query — `src/local/nextQuestion.ts`
Add a third param `sources: QuestionSource[] | null` to `getNextLocalQuestion`; when non-empty,
append `AND q.source IN (?, ...)` to both Stage 1 and Stage 2 queries (mirroring the existing
`catSql` pattern). Backward compatible (null = no source filter).

### B3. Session orchestration
- `src/types/api.ts`: add `sources: QuestionSource[] | null` to `StudySession`.
- `src/local/engine.ts`: `startLocalSession(categoryIds, mode, sources)` stores `sources`;
  `getNextForSession` passes `session.sources` as the new third arg.
- `src/hooks/useStudySession.ts`: `startSession(categoryIds?, mode?, sources?)` → forwards to
  `startLocalSession`.
- `src/pages/StudySessionPage.tsx`: extend `SessionState` with `sources?: QuestionSource[]`,
  read it from `location.state`, pass to `startSession`.

### B4. `CategoryPickerModal.tsx` — source section + category narrowing
- Change props: `selectedSources: QuestionSource[]` in, `onConfirm: (sources, categoryIds) => void`.
- Add a source multi-select section at the top of the dialog (checkbox row / chips), populated by
  `getAvailableSources()` and labeled via `SOURCE_LABELS`.
- When ≥1 source is selected, compute `getCategoryIdsForSources(selectedSources)` and show only
  top-level categories that are in the set **or have a child in the set** (build child→parent map
  from `categories`). When no source selected, show all top-level categories (current behavior).
- Deselect categories that fall out of range when the source selection changes.
- Title can stay "Wybierz kategorie" or become "Wybierz źródła i kategorie".

### B5. `NaukaPage.tsx` — wire it up
- Add `selectedSources` state alongside `selectedCategoryIds`; pass both to the modal and store
  back on confirm.
- Update `categoryLabel`/the row text to reflect source selection (e.g. show selected source
  labels, or "Wszystkie źródła").
- `startSession(mode)` adds `sources: selectedSources.length ? selectedSources : undefined` to the
  navigate `state`.

## Files

| File | Change |
|---|---|
| `src/components/QuestionCard.tsx` | **new** — extracted shared card + `showSource` prop |
| `src/pages/SourceQuestionsPage.tsx` | use shared card; otherwise unchanged |
| `src/pages/PytaniaPage.tsx` | category Autocomplete + filters + all-sources results (state in URL query params via `useSearchParams`); keep cards |
| `src/local/questions.ts` | `getAvailableSources`, `getCategoryIdsForSources` |
| `src/local/nextQuestion.ts` | optional `sources` filter |
| `src/local/engine.ts` | thread `sources` through session start/next |
| `src/types/api.ts` | `StudySession.sources` |
| `src/hooks/useStudySession.ts` | `startSession` accepts `sources` |
| `src/pages/StudySessionPage.tsx` | read `sources` from location state |
| `src/components/study/CategoryPickerModal.tsx` | source multi-select + category narrowing + new `onConfirm` |
| `src/pages/NaukaPage.tsx` | `selectedSources` state, label, navigate state |

All user-facing strings in Polish (consistent with existing code).

## Verification
- `cd /home/user/Projects/quizowanie/frontend && npm run build` (tsc + vite) — clean.
- `npm run lint` — no *new* errors (7 pre-existing react-hooks errors per STATUS.md).
- `npm run test` — vitest, incl. the frozen SM-2 fixture, still green (SRS untouched).
- Manual (dev server):
  - **BrowsePage**: type a category in the search → matching category(ies) selectable → results
    list shows questions from multiple sources with a source chip; difficulty/type toggles refine;
    pagination works; source cards still navigate to unchanged subpages.
  - **Subpage** (`/browse/opentdb` etc.): identical behavior to before (no source chip).
  - **Study picker**: select a source → category list narrows to that source's categories →
    confirm → session only serves questions from the chosen source(s); with no source selected,
    behavior is unchanged.
