# Architecture

## Deployment topology (planned)

| Layer | Service | Role |
|---|---|---|
| Frontend | Firebase Hosting | React + MUI SPA |
| Auth | Firebase Auth | Identity provider (email/password + Google) |
| API | Cloud Run | FastAPI container (`backend/Dockerfile`) |
| Database | Neon Postgres | All persistent app data |

The API is **fully stateless** — no session state server-side. Firebase Auth
issues JWTs; FastAPI verifies them on every request via `firebase-admin`.

## Auth flow

```
Firebase Auth SDK (frontend)
   │ user signs in → ID token (auto-refreshed by SDK)
   ▼
Axios request interceptor (frontend/src/api/client.ts)
   │ Authorization: Bearer <firebase_id_token>
   ▼
FastAPI get_current_user dependency (backend/app/dependencies.py)
   │ firebase_auth.verify_id_token(token)
   │ first verified request → upsert User row keyed by firebase_uid
   ▼
Internal user.id (UUID) used for all DB lookups
```

Key points:
- The frontend interceptor calls `getIdToken()` (cached token, refreshed only
  near expiry). See `frontend/src/api/client.ts`.
- The backend upserts a `User` on first contact in `get_current_user`. Email is
  pulled from the decoded token. No separate registration endpoint —
  `POST /auth/me` just triggers the upsert and returns the profile.
- `firebase-admin` is initialized once at app startup via the `lifespan` hook in
  `main.py` → `init_firebase()` using Application Default Credentials.

## Request lifecycle

Every route except `GET /health` depends on `get_current_user`, which depends on
`get_db` (an async SQLAlchemy session per request). A request that fails token
verification gets a `401` with a Polish detail message (`Token wygasł` /
`Nieprawidłowe dane uwierzytelniające`).

## Data model overview

```
users ──< study_sessions ──< study_answers >── questions >── categories (self-ref)
  │                                                │
  └──< user_question_progress >───────────────────┘   (SM-2 state, unique per user+question)
```

- **users** — Firebase-backed identity + a `preferences` JSONB blob.
- **categories** — self-referential (`parent_id`) for category → subcategory.
- **questions** — content + `type`/`payload` + `source` + `verification_status` + `difficulty`.
- **user_question_progress** — one row per (user, question); holds SM-2 state.
- **study_sessions** / **study_answers** — session log; answers drive stats.

Full column-level schema is in [BACKEND.md](BACKEND.md#database-schema).

## Cross-cutting conventions

- **Async everywhere** on the backend — async SQLAlchemy + asyncpg. Stats run
  five queries in parallel with `asyncio.gather`.
- **Polish UI strings** are hard-coded (no i18n library). Error `detail` messages
  from the API are also Polish.
- **Strict TypeScript** on the frontend; all API shapes live in
  `frontend/src/types/api.ts`.
- **Theme is centralized** in `frontend/src/theme.ts` (dark mode, Inter font).
- **Answers are never leaked early**: `GET /study/sessions/{id}/next` and
  `GET /questions` return `QuestionResponse` (no answer). The answer is only in
  `QuestionDetailResponse` (`GET /questions/{id}`, `GET /browse/questions`) and
  the `POST .../answer` response.
</content>
