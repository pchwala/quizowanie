# Quizowanie — Frontend

React 19 + TypeScript SPA (Vite), wrapped by Capacitor for Android. Polish UI,
dark theme.

**Local-first**: questions, SRS progress and the answer log live in on-device
SQLite (`jeep-sqlite` wasm + IndexedDB on web, the native plugin on Android).
The app needs the network once, to download the question bundle; after that
study works offline. The API is used only for `GET /bundles/latest` and
`POST /sync`.

Full reference: [../doc/FRONTEND.md](../doc/FRONTEND.md).

## Setup

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173 (backend must be reachable on first run)
```

### Env (`.env.local` for dev, `.env.production` for deploy — both gitignored)

```
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run test` | vitest (SM-2 frozen fixture) |
| `npm run lint` | eslint (7 known `react-hooks` errors — see doc/STATUS.md) |
| `npm run preview` | serve the production build |

## Layout

```
src/
  local/      on-device data layer: db, srs (SM-2), nextQuestion, engine,
              bundle, stats, questions, userQuestions, flags, identity
  sync/       syncEngine — POST /sync mirror
  hooks/      useStudySession + TanStack Query wrappers over local/*
  pages/      Nauka, StudySession, Pytania, SourceQuestions, AddQuestion,
              MojePytania, Menu, Login
  components/ flashcard, study, stats, layout, common, QuestionCard,
              ReportQuestionDialog
  contexts/   AuthContext (anonymous-first Firebase auth)
  types/api.ts  shared data shapes
  theme.ts    MUI theme (single source of colours/typography)
```

Routes: `/study`, `/study/session`, `/browse`, `/browse/:source`,
`/questions/new`, `/questions/mine`, `/menu`, `/login`.

## Rules

- Pages stay thin; logic lives in `hooks/` and `local/`.
- All user-facing strings are Polish and hard-coded (no i18n).
- `src/local/srs.ts` is the **only** SM-2 implementation. If
  `srs.test.ts` fails, every user's schedule changes — only change it on purpose.
- After a `sql.js` major bump, re-copy `node_modules/sql.js/dist/sql-wasm.wasm`
  to `public/assets/`.

## Deploy

```bash
npm run build && firebase deploy --only hosting     # project pub-quizowanie
```

Android: `capacitor.config.ts` is ready (`com.quizowanie.app`); run
`npx cap add android` to generate the native project (not done yet).
