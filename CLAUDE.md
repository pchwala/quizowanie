# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quizowanie** is a Polish-language training platform for competitive quiz players — specifically for TV game shows like *1 z 10*, *Milionerzy*, and *PubQuiz*. Think Duolingo/Anki for Polish trivia enthusiasts.

The app is Polish and targets a Polish audience exclusively.

## Development Environment

Project root:
/home/Projects/quizowanie

Python 3.14 with a local `.venv`:

```bash
source .venv/bin/activate
```

The venv is at backend/.venv

The `dev/` directory contains planning docs.

Do not create working branches, edit in current branch

## Architecture Decisions (Planned)

### Question Data Model

Every question carries:
- **Content**: question text, answer, explanation (the "why"), optional mnemonic
- **Source**: one of `1z10_archive | milionerzy_archive | pubquiz_archive | opentdb | user_submission`
- **Verification status**: `verified | pending | rejected`
- **Difficulty**: 1–10 (computed from user success rate, answer time, moderator rating)
- **Category / subcategory**

### Question Verification Workflow

User submissions flow through AI pre-screening (factual consistency, duplicate detection, spelling, category tagging) before human moderation. AI reduces moderator workload but is never the final authority.

### Core MVP Scope

1. User accounts
2. Question database with source + verification tagging
3. Categories / subcategories
4. Flashcard study with spaced repetition (SRS) for missed/weak questions
5. Weakness tracking and statistics
6. Daily training mode
7. AI-generated practice questions for weak areas

Game modes come after MVP:
- **1 z 10 mode** — timed answers (5 s), streak tracking, pressure simulation
- **Milionerzy mode** — ABCD format with 50:50, ask-AI-audience, ask-AI-expert lifelines
- **PubQuiz mode** — simulated rounds (questions + music + image + geography)

### Audio/Video Questions

Store YouTube URL + start/end timestamps and embed via the YouTube player. Do not download or store clips locally (copyright).

### Fact Network (post-MVP)

When a user answers incorrectly, surface related facts/entities to support associative learning.
