# Mobile Considerations — Android (Capacitor)

The web app is the starting point. Android is the primary target going forward; the web app is maintained in parallel from the same codebase.

---

## 1. Capacitor Setup

**Packages**: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`

**Config** (`capacitor.config.ts` in `frontend/`):
```ts
import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.quizowanie.app',
  appName: 'Quizowanie',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};
export default config;
```

**Critical**: `vite.config.ts` must set `base: './'` — Android WebView loads from `file://`, so absolute paths break asset loading.

**Android manifest permissions needed**:
- `INTERNET`
- `VIBRATE`
- `RECEIVE_BOOT_COMPLETED` (for scheduled notifications)
- `POST_NOTIFICATIONS` (Android 13+)

**Build flow**:
```
vite build
cap copy android
cd android && ./gradlew assembleRelease   # .apk for sideload
cd android && ./gradlew bundleRelease     # .aab for Play Store
```

The `android/` directory lives in the repo root. The web app (`firebase deploy`) is unaffected — Capacitor only wraps the build for Android.

---

## 2. Local SQLite Database

Use `@capacitor-community/sqlite`.

### What lives locally

| Table | Contents |
|-------|----------|
| `questions` | id, type, text, answer, payload (JSON), explanation, mnemonic, source, difficulty, category_id, bundle_version |
| `categories` | id, name, slug, parent_id |
| `local_srs_progress` | mirrors server `user_question_progress` — used when offline |
| `pending_answers` | unsynced study answers: question_id, quality, answered_at, session_uuid, synced |
| `meta` | key/value: local_bundle_version, last_sync_at |

### What stays server-side only

- User account and preferences
- Canonical `user_question_progress` (server is source of truth)
- `study_sessions` / `study_answers` (synced from `pending_answers`)
- Stats aggregation

**Rationale**: Questions (thousands of rows, read-only) are ideal for local storage. User progress must sync — keep it server-authoritative with a local shadow for offline use only.

---

## 3. Offline Support

### What works offline

- Full study sessions (flashcard flip → SM-2 rating) using local SQLite
- Browse questions
- View last-cached stats snapshot

### What requires network

- Login / registration (Firebase Auth)
- First question bundle download
- Stats sync and leaderboards

### Offline SM-2 behavior

1. On session start, load `local_srs_progress` from SQLite
2. Apply SM-2 locally on each answer (same algorithm as `backend/app/services/srs.py`)
3. Write result to `local_srs_progress` and `pending_answers` (`synced = false`)

### Sync on reconnect

1. Detect connectivity via `@capacitor/network`
2. Read `pending_answers` where `synced = false`
3. POST to `POST /study/sync` (bulk endpoint — see below)
4. On 200: mark rows `synced = true`
5. Fetch server `user_question_progress`, overwrite `local_srs_progress` entirely
6. Show toast: "Zsynchronizowano X sesji"

**Conflict resolution**: Server wins unconditionally. Local shadow is replaced after every sync.

### New backend endpoint: `POST /study/sync`

Accepts a bulk array of answers, applies SM-2 in chronological order, returns updated progress. Avoids N individual API calls on reconnect.

```json
// Request
{ "answers": [{ "question_id": 1, "quality": 4, "answered_at": "...", "session_uuid": "..." }] }

// Response
{ "synced": 12, "progress": [ ...updated user_question_progress rows... ] }
```

---

## 4. Question Update Strategy

### Bundle versioning

Backend exposes:
```
GET /bundles/latest → { version: "2026-06-09", url: "...", size_bytes: N, question_count: N, min_required_version: "..." }
```

Bundles are versioned JSON files in Firebase Storage. Format:
```json
[{ "id": 1, "type": "question", "text": "...", "answer": "...", "is_active": true, ... }]
```

### Update flow on app launch

1. Fetch `GET /bundles/latest`
2. Compare `version` to `meta.local_bundle_version` in SQLite
3. If newer: download JSON in background, upsert all rows, update `local_bundle_version`
4. App stays usable immediately with existing local data during download

### Hard deletions and corrections

Inactive questions are included as tombstones: `{ "id": 42, "is_active": false }`. Client deletes or soft-flags those rows. Updated questions replace old ones via same-id upsert.

### Force refresh

If a critical correction ships, `min_required_version` is bumped in the bundle manifest. If `local_bundle_version < min_required_version`, the app blocks study mode and forces a download before continuing.

### Delta updates (post-launch optimization)

```
GET /bundles/delta?since=<version>
```

Returns only changed/added/deleted questions since the given version. Reduces download size for incremental updates.

---

## 5. Push Notifications

**Stack**: Firebase Cloud Messaging (FCM) + `@capacitor/push-notifications`. Firebase is already in the stack.

### Registration flow

1. On first launch after login: call `PushNotifications.requestPermissions()`
2. On grant: `PushNotifications.register()` → receive FCM token
3. POST token to `POST /users/me/fcm-token`
4. Backend stores in `users.fcm_token` (new column + migration)

### Notification types

| Type | Trigger | Polish copy |
|------|---------|-------------|
| Daily reminder | Cron 09:00 | "Masz X pytań do powtórki dziś" |
| Streak at risk | Cron 20:00 if no session today | "Twoja passa X dni jest zagrożona!" |
| New questions | After bundle publish | "Dodano N nowych pytań do bazy" |
| Weekly summary | Monday morning | "W tym tygodniu odpowiedziałeś na X pytań" |

### Backend work

- `fcm_token` column on `users` + Alembic migration
- `POST /users/me/fcm-token` endpoint
- Notification service using `firebase-admin` SDK's `messaging.send()`
- Cloud Scheduler jobs for daily/weekly crons
- Notification preferences in `users.preferences` JSON (user can opt out per type)

### Android specifics

- Create notification channels at app startup (Android 8+): "Przypomnienia", "Statystyki"
- Handle notification tap → deep link to StudyPage or StatsPage via `@capacitor/app` `appUrlOpen` listener

---

## 6. Mobile UI Adaptations

### Touch targets

MUI defaults (36px icons) are too small for thumbs. In `theme.ts`:
```ts
components: {
  MuiIconButton: { defaultProps: { size: 'large' } },
  MuiButton: { defaultProps: { size: 'large' } },
}
```
All interactive elements must be ≥48px tall.

### FlashCard gestures

- Tap anywhere on card to flip (click already works — verify on touch)
- Swipe left = "Again" (quality 0), swipe right = "Easy" (quality 5) as gesture shortcuts
- `@capacitor/haptics`: short vibration on card flip, medium on rating submit

### Navigation

On mobile, the sidebar drawer is hard to reach on large screens. Replace with MUI `BottomNavigation` on Android:
```ts
const isMobile = Capacitor.isNativePlatform();
// render BottomNavigation if isMobile, Sidebar if not
```

Sidebar stays for web; bottom nav bar for Android. No change to web UX.

### Soft keyboard

On Android, the soft keyboard resizes the viewport and can overlap inputs on BrowsePage. Use the `visualViewport` API to offset content when the keyboard is open.

### Status bar

```ts
import { StatusBar, Style } from '@capacitor/status-bar';
StatusBar.setBackgroundColor({ color: '#121212' }); // matches dark theme
StatusBar.setStyle({ style: Style.Dark });
```

### Splash screen

`@capacitor/splash-screen` with app logo. Configure `launchShowDuration: 0` + `autoHide: false`, then call `SplashScreen.hide()` after first paint.

### Safe areas

In `AppShell.tsx` root div:
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```
Handles notch and gesture nav bar overlap.

### Android back button

```ts
App.addListener('backButton', ({ canGoBack }) => {
  if (isStudySessionActive) showExitConfirmDialog();
  else if (canGoBack) window.history.back();
  else App.exitApp();
});
```

---

## 7. Build & Distribution

### Keystore signing

```bash
keytool -genkey -v -keystore quizowanie.keystore -alias quizowanie -keyalg RSA -keysize 2048
```

Store in a secret manager — **never commit to git**. Reference in `~/.gradle/gradle.properties` locally; use GitHub Actions secrets in CI.

### Play Store

- Target API 34+ (required by policy)
- `minSdkVersion 24` (Android 7 — covers ~98% of active devices)
- Release track: Internal → Closed testing → Open testing → Production rollout

### Firebase App Distribution (beta/dev)

```bash
./gradlew assembleDebug
firebase appdistribution:distribute android/app/build/outputs/apk/debug/app-debug.apk \
  --app <FIREBASE_APP_ID> --groups testers
```

No Play Store account required for testers.

### CI/CD (GitHub Actions)

Single pipeline on push to `main`, two parallel jobs:
1. **Web**: `vite build` → `firebase deploy --only hosting`
2. **Android**: `vite build` → `cap copy android` → `./gradlew bundleRelease` → sign → upload to Play Store internal track

### Versioning

Keep a `VERSION` file in repo root (e.g. `1.0.0`). Read it in `android/app/build.gradle` as `versionName`. Bump on every release. Align `versionCode` with an auto-incremented CI build number.

---

## 8. Mobile-First Architecture Shifts

Decisions that touch the web app too — make these consciously before the mobile port.

### API base URL

`VITE_API_BASE_URL` env var must always be set. Android WebView cannot reach `localhost`. The `.env.android` build uses the production Cloud Run URL.

### Auth persistence

Firebase Auth persistence defaults to `LOCAL` (survives app restart via IndexedDB) — this is correct and works in Capacitor WebView. Do not change it.

### Deep linking

Register `quizowanie://` URI scheme in `AndroidManifest.xml`. In `main.tsx`:
```ts
App.addListener('appUrlOpen', ({ url }) => {
  const path = new URL(url).pathname;
  navigate(path); // React Router
});
```
Used for push notification taps routing to the correct page.

### Analytics

Add Firebase Analytics before launch. Track: session starts, card flips, quality ratings, daily active use. Essential for prioritizing premium features.

### Error reporting

Add Sentry (`@sentry/capacitor`) before Play Store launch. Mobile crashes are silent without a crash reporter.

### Performance baseline

Target <2s first meaningful paint on a mid-range Android device (Snapdragon 6xx). Lazy-load BrowsePage and StatsPage via `React.lazy` / `Suspense` — they are not in the critical path on launch.

---

## Priority Order

| # | Task | Phase |
|---|------|-------|
| 1 | Capacitor init + Android build compiles | MVP mobile |
| 2 | `base: './'` in vite.config | MVP mobile |
| 3 | Local SQLite + question bundle download | MVP mobile |
| 4 | Offline study session + pending_answers sync | MVP mobile |
| 5 | `POST /study/sync` bulk endpoint | Launch-ready |
| 6 | Mobile UI polish (bottom nav, haptics, status bar, safe areas) | Launch-ready |
| 7 | Push notifications (FCM + backend cron) | Launch-ready |
| 8 | Play Store setup + signing + CI/CD | Launch-ready |
| 9 | Delta bundle updates | Post-launch |
| 10 | Deep linking + analytics + Sentry | Post-launch |
