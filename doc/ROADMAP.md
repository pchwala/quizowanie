# Roadmap — Post-MVP

The MVP is the SRS flashcard loop on a general (OpenTDB) question pool. Beyond
it, four big themes. Detailed planning notes live in `dev/`; this is the curated
summary.

## 1. Game modes

After the core loop is solid:

- **1 z 10 mode** — timed answers (~5 s), streak tracking, pressure simulation.
  Key insight: the value is the *format and pressure*, not unique questions —
  run it on the general pool now; don't block on show-specific data.
- **Milionerzy mode** — ABCD format with lifelines (50:50, ask-AI-audience,
  ask-AI-expert). Maps directly onto the `multiple` question type + `payload`.
- **PubQuiz mode** — simulated rounds (questions + music + image + geography).

## 2. Authentic archive content (the real moat)

The general pool is a commodity; authentic 1z10/Milionerzy/PubQuiz questions are
the differentiator. Treat the three shows as three different problems and
**bootstrap rather than boil the ocean** — seed trust with the archive, sustain
volume with community submissions + error reports + AI pre-screening.

| Show | Best source | Priority |
|---|---|---|
| Milionerzy | Fandom Wiki PL (**CC-BY-SA 3.0**, legal + reusable) | Do first |
| General pool | OpenTDB (have it) + community DBs | Ongoing |
| 1 z 10 | YouTube full episodes → Whisper ASR + LLM segmentation | Defer (high effort) |
| PubQuiz | Community banks (IRC Quizbot ~116k, pubquiz.pl) — licensing TBD | Later |

Provenance is already modeled via `source` + `verification_status`. Legal stance
(chosen): pragmatic — scrape broadly for MVP seeding, transform heavily, do a
licensing cleanup before any paid/public launch. EU/Polish *sui generis database
right* means: don't bulk-clone any single DB; ingest, transform, mix, attribute.

**Likely next task**: a Milionerzy Fandom-wiki scraper/parser emitting the seed
JSON format (`dev/DATA_SOURCING.md`).

## 3. Mobile — Android via Capacitor

Android is the primary target going forward; the web app is maintained in
parallel from the same codebase. Full plan in `dev/MOBILE_CONSIDERATIONS.md`.

Highlights:
- **Capacitor** wrapping the Vite build; `base: './'` required (WebView loads
  from `file://`). `android/` dir in repo root.
- **Local SQLite** (`@capacitor-community/sqlite`) mirrors read-only questions +
  a local SRS shadow; user progress stays server-authoritative.
- **Offline study** with `pending_answers`, synced via a new bulk
  `POST /study/sync` endpoint (server wins conflicts).
- **Question bundle versioning** — `GET /bundles/latest`, tombstones for deletes,
  `min_required_version` force-refresh, delta updates post-launch.
- **Push notifications** — FCM + `@capacitor/push-notifications`; new `fcm_token`
  column + crons (daily reminder, streak-at-risk, new questions, weekly summary).
- **Mobile UI** — bottom nav on native, ≥48px touch targets, haptics, swipe
  gestures, status bar/splash/safe-areas, Android back-button handling.
- **Build/CI** — keystore signing (never commit), Play Store internal→prod track,
  Firebase App Distribution for beta, GitHub Actions (web + Android jobs).

Priority order (from the plan): Capacitor build → `base:'./'` → local SQLite +
bundle download → offline sync → `/study/sync` → mobile UI polish → push →
Play Store/CI → delta updates → deep links/analytics/Sentry.

## 4. Monetization — premium AI generation

Position as **"unlimited drilling volume on weak areas"**, not "better
questions" (AI trivia is a commodity; the archive is the moat). Full assessment
in `dev/MONETIZING_IDEAS.md`.

Critical risk: factuality. Competitive quiz players are pedantic, Polish-niche
content is the model's weakest area, and teaching a wrong fact is *negative*
value for a training app. The fix is **retrieval-first (grounded) generation**:

```
prompt → RETRIEVE (Wikipedia/source passages) → GENERATE (answers stated in source)
       → VERIFY (2nd model: answer literally supported, must cite sentence)
       → REFINE (style/spelling + related facts from same source)
       → STORE (cache, flag unverified, semantic dedup)
```

Shared pool means one bad question pollutes everyone → grounding pipeline is
mandatory, lean on the `verification_status` + "zgłoś błąd" report loop as the
QA safety net. Don't launch on hope — measure factual accuracy on Polish content
and gate the paid tier behind >95% before charging.

**Sequencing**: ship free archive + SRS first (the moat), add grounded
generation as the premium drilling tier afterward.

## Other planned product features (from CLAUDE.md / chatgpt notes)

- **User submissions** with AI pre-screening (factual consistency, duplicate
  detection, spelling, category tagging) → human moderation. AI is never final
  authority.
- **Error reporting** ("zgłoś błąd") — flagged question drops out during review.
- **Difficulty** computed from user success rate + answer time + moderator rating.
- **Audio/video questions** — store YouTube URL + start/end timestamps, embed via
  the YT player (never download/store clips — copyright).
- **Fact network** (post-MVP) — on a wrong answer, surface related facts/entities
  for associative learning.
</content>
