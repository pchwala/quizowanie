# Pre-Ship Strategy: Target Group & What Actually Matters for MVP

## Context

The working assumption has been that the question database is Quizowanie's core
value and that the app is "almost ready to ship" once the question bank is
high-quality. This document is a strategic review answering: **who is the target
group, what do they need, what must we provide, and what — beyond the question
DB — is most important before shipping.**

It is grounded in the existing docs (`doc/`, `dev/`) and a code audit of what is
actually built vs. only planned (status flags below reflect that audit, 2026-06).

---

## 1. Reframing "core value"

The question DB is **necessary but not the moat**. For a *training* app
(Duolingo/Anki for Polish trivia), the defensible value is a stack:

1. **Trust** — every fact is correct. For this audience a wrong fact is *negative*
   value, not zero (you'd be teaching a wrong answer for a competition).
2. **The learning system** — SRS (SM-2) + weakness targeting that produces real,
   measurable improvement. **This is already built and is your strongest asset.**
3. **Habit** — they return daily. A trivia app lives or dies on retention, not
   feature count.
4. **The "why" layer** — explanations, mnemonics, related facts. This is what
   separates a *training* app from a *quiz* app, and it's in the data model but
   under-leveraged in the loop.

Implication: **quality and Polish-relevance of questions beats raw count.** 4,500
translated OpenTDB questions is a risk — OpenTDB is Anglo-centric and machine
translation seams are obvious to a pedantic Polish audience. 1,500 curated,
verified, Polish-relevant questions would serve the target group better.

---

## 2. Target group

Polish competitive-quiz enthusiasts, segmented by motivation:

| Segment | Size | Motivation | Traits | Role for us |
|---|---|---|---|---|
| **Aspirants / competitors** (want to get on / already on 1z10, Milionerzy) | Small | Win, qualify, prestige | Hyper-knowledgeable, *pedantic*, catch wrong facts instantly | **Trust validators + content QA army.** Win them = credibility. |
| **PubQuiz regulars** | Medium | Win their weekly league, social | Competitive, consistent, community-connected | Word-of-mouth engine; community already organized (FB groups, pubquiz.pl, IRC quizbot). |
| **Casual trivia lovers / lifelong learners** | Large | Habit, self-improvement, fun | Less pedantic, most gamification-responsive, most monetizable | Volume + revenue; retention-driven. |
| **Students / study-aid users** | Medium | Exam/general-knowledge prep | Goal-oriented, episodic | Secondary; SRS already serves them. |

**The core tension:** the pedantic aspirants are the smallest group but the trust
gatekeepers; the casuals are the volume but won't sustain a moat. Strategy:
**win the aspirants for credibility and content QA, but build the product loop for
the casuals' habit.**

---

## 3. What they need → what we must provide

| They need | We must provide | Status |
|---|---|---|
| To trust the facts | Verified content + a fast **"zgłoś błąd"** report loop (turns pedantic users into free QA) | **ABSENT** — no report endpoint/model/UI |
| The dream (authentic show practice) | Real Milionerzy/1z10 archive content + show-format modes | Deferred (general pool only for MVP) — fine, but it's the eventual moat |
| To actually improve & retain | SRS + weakness targeting | **Built** (SM-2, stats, weak categories) |
| To understand, not just memorize | Explanations + mnemonics + "related facts" in the answer view | Data model supports it; surface it in the flip |
| To form a daily habit | Streaks, daily goal, **reminders** | **Partial** — streak/goal exist; no reminders/notifications |
| A good first impression | Onboarding: category pick, difficulty ramp, a hooking first session | **ABSENT** — drops straight to /study |
| Native Polish feel | Polished Polish UI + non-machine-flavored content | Needs a curation/QA pass |
| Eventually: to compete | Leaderboards, friends, challenges | Post-MVP (but matches the audience's nature) |

---

## 4. The most important things to consider before shipping (ranked)

**Code audit confirms these are absent/partial, not just undocumented.**

1. **Content quality & Polish-relevance pass (not count).** Audit the 4,500-pool:
   cut Anglo-centric/irrelevant items, fix translation seams, verify facts. Better
   to launch smaller and trusted. *This is the real "get the DB ready" work — it's
   curation, not acquisition.*

2. **"Zgłoś błąd" error-report loop.** Table stakes for a pedantic audience and
   your cheapest QA. Minimal: a report endpoint + a button on the answer view +
   flagged questions drop out pending review. **Strongly recommend in MVP or first
   fast-follow.** (Currently ABSENT.)

3. **Retention mechanics.** Streak + daily goal exist server-side; what's missing
   is the *nudge*. For a web MVP: visible streak, daily-goal celebration, and at
   least **email reminders** (push is post-MVP/mobile). Retention is the make-or-break
   metric for this product category.

4. **Onboarding / first session.** Category selection + a difficulty ramp so the
   first 5 minutes feel tailored and winnable, not a random firehose ordered by
   `question.id`. (Currently drops straight into /study.)

5. **Analytics from day one.** You cannot improve retention you can't see. Add
   lightweight event tracking (e.g. PostHog) for D1/D7 retention, session
   completion, questions/session, report rate, and where users quit. (Currently
   ABSENT.) **Ship this *with* the MVP, not after — early-user data is the most
   valuable and unrecoverable.**

6. **Go-to-market = hand-recruit the hardcore first.** Don't broad-launch. Recruit
   the first ~100 from existing quiz communities (pubquiz.pl, FB quiz groups, the
   IRC quizbot community). They validate quality, seed error reports, and become
   advocates. This matters more right now than any feature.

7. **Web vs. mobile mismatch.** A daily-habit trivia app naturally lives on the
   phone; roadmap already says Android is the going-forward primary. Consider a
   **soft web launch to the recruited cohort** while building the Capacitor Android
   app, rather than a big web launch the audience may not adopt as a daily habit.

8. **Legal/licensing sanity check before public launch.** OpenTDB is CC-BY-SA
   (attribution required); any scraped/seed content needs the planned cleanup pass.
   Fine for a closed cohort; required before public/paid.

9. **Defer with confidence:** AI generation (premium, needs the grounding pipeline
   + >95% factuality gate), show-format game modes, user submissions, fact network.
   None should block ship.

---

## 5. One-line strategic summary

> The question DB is necessary, but the moat is **trusted facts + a proven
> learning loop + daily habit**. Before shipping, prioritize **content quality
> over count, an error-report loop, retention nudges, onboarding, and analytics** —
> then soft-launch to a hand-recruited core of pedantic quiz players who will
> validate the trust and seed the content engine.
