# Plan: user-submitted questions + question reporting

## Context
Quizowanie is local-first: the on-device SQLite `questions` table drives all
study/browse/SRS, the backend has only `/health`, `/bundles/latest` (public,
ships `is_active AND verification_status=verified` questions) and `/sync` (auth'd
mirror of answer events + progress + prefs). Today **all questions come from
seeds** — there is no user write path. We're adding two user-generated-content
features:

1. **Author own questions** — open / ABCD / true-false formats, marked
   **private** or **public**. Private → personal category **"Moje pytania"**,
   studied only by the author. Public → category **"Pytania użytkowników"**,
   `verification_status=pending` (unreviewed), enters everyone's bundle once a
   moderator verifies it.
2. **Report/flag questions** — from the browse list and during study.

**Key product rules from the user:**
- A user's authored questions are their **permanent local content**, studyable
  immediately and synced to their account (restore guarantee).
- A **public** submission is *also* pushed to a shared moderation queue. Whatever
  the moderation outcome, **the author keeps their local copy** — even if
  rejected (rejection must NOT delete it from the author's device).
- Moderation = **store-as-pending only** for now: no AI pre-screening, no admin
  UI. Approving a submission is a manual DB action (set `verification_status`).

## Lifecycle / dedup design (the crux)
Authored questions live in the **same `questions` table** (server + local) so all
existing study/browse/SRS logic is reused unchanged. We distinguish them with
`submitted_by` (FK user) and `is_public`, and locally with `is_user_owned`.

- The client generates the question UUID; the **author's local copy and the
  shared server row share that id**, so when a verified public question later
  arrives via the bundle it upserts the *same* local row → no duplicate.
- The bundle delete is guarded with `AND is_user_owned = 0`, so a rejected (or
  any) public submission in `deleted_ids` is removed for *other* users but
  **kept for the author**.
- `/sync` pull returns all `questions WHERE submitted_by = me` (private +
  public, any status) → restores authored content on a fresh device regardless
  of bundle visibility. Bundle and authored-pull both upsert by id; neither
  clobbers `is_user_owned`.

Result: private = author-only forever; public-pending = author-only + queued;
public-verified = everyone (via bundle), still flagged owned on author's device;
public-rejected = author keeps it, everyone else never saw it.

## Backend changes (`backend/app`)
- **`models/question.py`**: add enum value `user_submission` to `QuestionSource`;
  add `submitted_by: Mapped[uuid|None]` (FK `users.id`, nullable — null = seed)
  and `is_public: Mapped[bool]` (default `True`). New `models/flag.py`
  `QuestionFlag` (id, `question_id` FK, `user_id` FK, `reason` str, `detail`
  text|None, `created_at`, `client_id` UUID **unique** for idempotency,
  `status` default `'pending'`). Register in `models/__init__.py`.
- **`routers/bundles.py`**: add `Question.is_public.is_(True)` to the `_ACTIVE`
  filter (and to the version/count query) so private/non-public never leak even
  if mis-verified. Categories query already returns all categories (the two new
  ones ship to clients automatically).
- **`schemas/sync.py`** + **`routers/sync.py`**: extend the mirror.
  - Request gains `authored_questions: list[AuthoredQuestionPush]` (push) and
    `flags: list[FlagPush]` (push). Reuse the existing event-dedup pattern:
    insert authored questions `ON CONFLICT (id) DO NOTHING` with
    `submitted_by=current_user.id`, `source=user_submission`,
    `verification_status=pending`, `is_public` from payload, `category_id`
    resolved to the right category; insert flags deduped by `client_id`.
    Treat authored questions as **immutable** once submitted (no edit/delete in
    scope).
  - Response gains `authored_questions: list[AuthoredQuestion]` = all
    `questions WHERE submitted_by = current_user.id` (full list, like progress),
    including `verification_status` and `is_public` for display.
- **Alembic migration** (`backend/alembic/versions`, new revision off
  `a7b6c5d4e3f2`): `ALTER TYPE questionsource ADD VALUE 'user_submission'` (must
  run outside a txn block — use `op.execute` with autocommit per Alembic docs);
  add `questions.submitted_by` + `questions.is_public`; create `question_flags`;
  **insert the two categories** `Pytania użytkowników` (slug
  `pytania-uzytkownikow`) and `Moje pytania` (slug `moje-pytania`) with fixed
  UUIDs so the server can resolve them. Reuse slug/translit helper conventions
  from `app/seeds/load_questions.py`.

## Frontend local store + sync (`frontend/src/local`, `src/sync`)
- **`local/db.ts`**: extend the `questions` `CREATE TABLE` with
  `is_user_owned INTEGER NOT NULL DEFAULT 0`, `is_public INTEGER`,
  `verification_status TEXT`, `synced INTEGER NOT NULL DEFAULT 1`; add a
  `question_flags` table (`event_id` PK, `question_id`, `reason`, `detail`,
  `created_at`, `synced` — mirrors `answer_events`) to `SCHEMA`. Because
  existing installs already have a `questions` table, add a small idempotent
  `migrate(db)` after `db.execute(SCHEMA)` that checks `PRAGMA table_info(questions)`
  and runs `ALTER TABLE questions ADD COLUMN …` for any missing column.
- **`local/bundle.ts`**: guard the tombstone delete with `AND is_user_owned = 0`
  (both the `questions` and `progress` deletes — keep author's progress too).
  The upsert SET list is unchanged (never touches the user columns).
- **`local/questions.ts`** (or new `local/userQuestions.ts`): `createUserQuestion(input)`
  — build `payload` per type (open `{accepted:[…]}`, multiple
  `{correct,incorrect:[…]}`, boolean `{correct}`, matching
  `app/seeds/load_questions.py`), `crypto.randomUUID()` id, resolve `category_id`
  by slug (`moje-pytania` for private, `pytania-uzytkownikow` for public) from
  local categories, insert into `questions` with `is_user_owned=1, synced=0,
  is_public, verification_status = is_public ? 'pending' : null`; then
  `void syncNow()`. `listUserQuestions()` → rows `WHERE is_user_owned = 1` for
  the "Moje pytania" view. `reportQuestion(questionId, reason, detail)` → insert
  into `question_flags` (synced=0) + `void syncNow()`. Update `rowToDetail`/row
  mapper for the new columns where needed.
- **`sync/syncEngine.ts`**: in the push payload add unsynced authored questions
  (`questions WHERE is_user_owned=1 AND synced=0`) and unsynced flags
  (`question_flags WHERE synced=0`), reusing the existing 500-row chunking; after
  push mark them `synced=1`. In the pull, upsert `response.authored_questions`
  into `questions` (`is_user_owned=1`, set `verification_status`/`is_public`,
  `synced=1`). Extend the `SyncRequest`/`SyncResponse` TS interfaces accordingly.
- Study selection (`nextQuestion.ts`, `engine.ts`, `options.ts`) needs **no
  change** — it already filters `is_active=1` and reads `payload`, which authored
  rows satisfy.

## Frontend UI (`frontend/src`)
- **Types** (`types/api.ts`): add `'user_submission'` to `QuestionSource` +
  `SOURCE_LABELS` (`'Użytkownik'`); add `NewQuestionInput`, `AuthoredQuestion`,
  and `FlagReason` (`'wrong_answer' | 'typo' | 'inappropriate' | 'duplicate' |
  'other'`) with Polish labels.
- **Add-question page** — new route `/questions/new` in `App.tsx` (detail page,
  BottomNav hidden like `/study/*`). Form mirrors `LoginPage`/`MenuPage` field
  patterns: format selector (Otwarte / ABCD / Prawda-Fałsz → conditional inputs:
  open = answer text; ABCD = 4 option fields + correct picker; boolean = correct
  toggle), question text, optional wyjaśnienie + mnemonika, visibility toggle
  (Prywatne / Publiczne), and a category `Select` (reuse `useCategories`) shown
  only for private (public is forced to "Pytania użytkowników"). Submit via a
  `useCreateQuestion` mutation (TanStack `useMutation` like
  `useUserPreferences`), invalidate `['browse/questions']`/`['categories']`,
  show success Alert, navigate back.
- **Entry points**: a "Dodaj pytanie" `ListItemButton` on **MenuPage** plus a
  "Moje pytania" entry → simple list page using `listUserQuestions()` with status
  chips (Prywatne / W weryfikacji / Zaakceptowane / Odrzucone). Optionally an add
  affordance on **PytaniaPage**.
- **Report dialog** — new `components/ReportQuestionDialog.tsx` following
  `CategoryPickerModal` structure (DialogTitle + close, DialogContent, DialogActions):
  reason `Select` + optional detail `TextField` + submit via `useReportQuestion`.
  Attach a flag `IconButton` (`OutlinedFlagIcon`) to the `QuestionCard` chip row
  in `SourceQuestionsPage.tsx` and a corner button on the `FlashCard` study view.
  Confirm with a `SyncToast`-style/snackbar message.

## Out of scope (note in PR)
AI pre-screening; moderator/admin review UI (approval is a manual DB update for
now); editing or deleting an already-submitted question; per-user "Moje pytania"
as distinct categories (it is one shared category label, privacy enforced by
`submitted_by` + not-bundled).

## Verification
1. **Backend**: `cd backend && source .venv/bin/activate`; `alembic upgrade head`
   against the test DB; confirm the two categories exist and the enum value was
   added. Run any backend tests.
2. **Frontend types/build**: `cd frontend && npx tsc --noEmit`, `npx eslint` on
   changed files, `npm test` (SRS fixture stays green — untouched).
3. **End-to-end (`npm run dev`)**:
   - Add a **private** question → appears under "Moje pytania", is studyable in a
     session, survives reload (persisted).
   - Add a **public** question → studyable locally, shows "W weryfikacji"; verify
     a `questions` row exists server-side with `verification_status=pending`,
     `is_public=true`, `source=user_submission`, correct `submitted_by`.
   - Manually set that row to `verified` in the DB → after bundle refresh it is
     present (no duplicate for the author; visible to a second account).
   - Manually set a different public submission to `rejected` → it disappears for
     a second account but **remains** on the author's device.
   - Report a question (browse + study) → a `question_flags` row appears after
     sync; reporting works offline then flushes on reconnect.
   - Fresh-device restore: sign in on a clean profile → authored private/public
     questions return via `/sync`.
