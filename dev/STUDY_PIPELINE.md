# Study Pipeline

## Overview

The study flow is session-based. A user starts a session (optionally scoped to a category), fetches questions one at a time, submits answers, and ends the session. All progress is persisted in `user_question_progress` using the SM-2 spaced repetition algorithm.

---

## Endpoints

```
POST /study/sessions                      → create session, returns session_id
GET  /study/sessions/{id}/next            → fetch next question (no answer revealed)
POST /study/sessions/{id}/answer          → submit quality score, reveals correct answer
POST /study/sessions/{id}/end             → close session (sets ended_at)
```

---

## Quality Scale

Answers are not free-text graded — the client sends a quality score from the user's self-assessment:

| Quality | Meaning |
|---------|---------|
| 0 | Complete blackout / wrong |
| 3 | Correct but required significant effort |
| 4 | Correct with minor hesitation |
| 5 | Perfect recall |

Quality 1 and 2 are intentionally skipped (SM-2 convention — the meaningful breakpoints are 0, 3, 4, 5).

---

## Question Selection Logic (`GET .../next`)

Two stages, tried in order:

**Stage 1 — Due SRS questions**
`user_question_progress` rows for this user where `next_review_at <= today`, joined to active + verified questions, ordered by `next_review_at ASC` (most overdue first).

**Stage 2 — Unseen questions**
Active + verified questions with no `user_question_progress` row at all for this user, ordered by `question.id` (deterministic → same question is returned on reconnect until answered).

If both stages are empty → `404 Brak pytań do nauki` (session exhausted).

Category filter from the session is applied to both stages.

The endpoint is **idempotent**: re-fetching before submitting an answer returns the same question (due questions stay due until answered; unseen questions stay unseen until a progress row is created).

---

## SM-2 Algorithm (`POST .../answer`)

On each answer, `apply_sm2(progress, quality)` updates the progress row:

```
if quality >= 3:
    repetitions == 0 → interval = 1 day
    repetitions == 1 → interval = 6 days
    repetitions >= 2 → interval = round(interval_days × easiness_factor)
    repetitions += 1
else:
    repetitions = 0
    interval = 1 day

easiness_factor = max(1.3, ef + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
next_review_at = today + interval
```

Easiness factor starts at 2.5. It increases with quality 5, stays roughly flat at quality 4, and decays toward the 1.3 floor for quality 3 and below. A question answered perfectly repeatedly will eventually have an interval measured in months.

---

## User Journey

### Brand new user

`user_question_progress` is empty. Stage 1 returns nothing. Stage 2 returns all questions (filtered by category if set), ordered by `question.id`. The user works through unseen questions in a stable, deterministic order.

### After answering a few questions

Each submitted answer creates a `user_question_progress` row with `next_review_at` set. Those questions leave Stage 2 (no longer unseen). The next day, questions answered with quality < 3 reappear in Stage 1 (interval reset to 1). Questions answered with quality >= 3 reappear after 1 day (first correct answer) or 6 days (second consecutive correct answer).

### Returning user with history

Stage 1 fills with overdue questions — ordered so the most overdue appear first. The user works through their review queue before seeing any new unseen questions. Once the queue is cleared, Stage 2 resumes introducing new material.

### Well-trained user

Intervals compound. A question answered perfectly three times has an interval of roughly `1 → 6 → 15 days` (6 × 2.5). After a few more perfect answers the interval is months. Stage 1 on a given day may contain only a handful of questions; Stage 2 introduces new ones to fill the session.

### Exhausted session

When both stages return nothing — all seen questions are scheduled for the future and all unseen questions have been encountered — the endpoint returns `404`. This is expected behaviour; the client should show a "nothing left today" message.

---

## Data Written Per Answer

| Table | What is written |
|-------|----------------|
| `user_question_progress` | Created on first answer; updated (SM-2 state) on every subsequent answer |
| `study_answers` | One row per answer — drives stats and weak-category aggregation |
| `study_sessions` | `questions_answered` incremented; `ended_at` set on session end |
