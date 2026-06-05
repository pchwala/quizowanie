Focus on backend logic
Make me a overview description of MVP features

User accounts
Question database
Categories/subcategories
Statistics
Weakness tracking
Daily training mode
Spaced repetition for missed questions


Gameshow Training App – MVP Feature Overview
Goal

A web application that helps quiz enthusiasts systematically improve their knowledge by identifying weak areas, tracking progress, and repeatedly exposing them to questions they struggle with.

The MVP focuses on a single core loop:

Answer questions → identify weaknesses → schedule reviews → improve retention.

1. User Accounts
Features
Registration and login
Password reset
User profile
Personal training history
All statistics and progress stored per user
Stored Data

User:

id
email
display_name
created_at

User Settings:

daily_goal_questions
preferred_categories
training_preferences
MVP Notes

Social login can wait until later.
Email/password authentication is sufficient.

2. Question Database
Features

Central repository of quiz questions.

Questions contain:

Question text
Correct answer
Explanation
Category
Subcategory
Difficulty
Example

Question:

Which country has the longest coastline in the world?

Answer:

Canada

Explanation:

Canada has approximately 243,000 km of coastline.

Category:

Geography

Subcategory:

Countries

Difficulty:

Medium

Stored Data

Question:

id
question_text
answer
explanation
category_id
subcategory_id
difficulty
created_at
MVP Notes

Start with manually imported questions.

No AI generation initially.

3. Categories & Subcategories
Purpose

Allow tracking strengths and weaknesses at a granular level.

Example Structure

History

Ancient History
Middle Ages
Modern History

Science

Physics
Chemistry
Biology

Entertainment

Movies
TV Shows
Music
Stored Data

Category:

id
name

Subcategory:

id
category_id
name
4. Daily Training Mode
Purpose

Primary way users interact with the app.

Flow
User starts training session.
System selects questions.
User answers.
User marks:
Correct
Incorrect
Results recorded.
Weaknesses updated.
Spaced repetition queue updated.
Question Selection Priority

Mix of:

New questions
Previously missed questions
Weak categories

Example:

Daily session of 20 questions:

10 new
5 weak-area
5 review questions
Stored Data

Training Session:

id
user_id
started_at
completed_at

Question Attempt:

id
session_id
question_id
user_answer
correct
response_time
5. Statistics
Purpose

Show measurable improvement over time.

Global Metrics
Total questions answered
Total correct answers
Overall accuracy
Questions answered this week
Current streak
Category Metrics

Per category:

Accuracy %
Total attempts
Correct answers

Per subcategory:

Accuracy %
Total attempts
Correct answers
Trend Metrics
Accuracy over time
Most improved categories
Most problematic categories
Example Dashboard

Overall Accuracy:

74%

Questions Answered:

2,381

Strongest Category:

Geography (91%)

Weakest Category:

Chemistry (54%)

6. Weakness Tracking
Purpose

Automatically discover knowledge gaps.

Logic

Every answer updates category scores.

Example:

Physics:

50 attempts
42 correct
84%

Chemistry:

40 attempts
18 correct
45%

Chemistry becomes a weak area.

Weakness Score

Simple MVP formula:

weakness_score =
(1 - accuracy) * log(total_attempts + 1)

Benefits:

Ignores tiny sample sizes
Prioritizes categories repeatedly answered incorrectly
Usage

Weak categories receive:

More daily questions
Higher spaced repetition priority
7. Spaced Repetition for Missed Questions
Purpose

Prevent users from repeatedly forgetting the same information.

When User Misses Question

Create review item:

interval = 1 day

If answered correctly:

1 day
→ 3 days
→ 7 days
→ 14 days
→ 30 days
→ 90 days

If answered incorrectly again:

reset to 1 day
Stored Data

Review Item:

user_id
question_id
next_review_at
repetition_count
last_result
Daily Selection

Before selecting new questions:

fetch all due reviews

Due reviews always have priority.

Core MVP User Journey
User creates account.
User completes daily training.
Answers are recorded.
Statistics update.
Weak categories identified.
Missed questions enter spaced repetition queue.
Future sessions prioritize:
Due reviews
Weak areas
New content
User gradually improves weak categories and retention.
Suggested MVP Database Tables
users
user_settings
categories
subcategories
questions
training_sessions
question_attempts
review_items

That's enough to build a fully functional MVP without introducing AI, multiplayer, leaderboards, content creation tools, or mobile-specific features. The core learning loop would already be complete and useful.

Expand on suggested DB schemas for the tables 
Database Schema Proposal (MVP)

This schema is optimized for:

PostgreSQL
Firebase Auth + custom backend
Future mobile app support
Easy analytics
Easy spaced repetition implementation
users

Stores user profile information.

users
Column	Type	Notes
id	uuid	PK
auth_provider_id	varchar	Firebase UID
email	varchar	unique
display_name	varchar	
created_at	timestamptz	
updated_at	timestamptz	

Indexes:

unique(email)
unique(auth_provider_id)
user_settings

User preferences.

user_settings
Column	Type
user_id	uuid FK users
daily_goal_questions	integer
daily_goal_minutes	integer
preferred_difficulty	varchar
created_at	timestamptz

Example:

{
  "daily_goal_questions": 20,
  "daily_goal_minutes": 15,
  "preferred_difficulty": "mixed"
}
categories

Top-level categories.

categories
Column	Type
id	uuid
name	varchar
description	text
created_at	timestamptz

Example:

{
  "name": "Science"
}
subcategories

Nested under categories.

subcategories
Column	Type
id	uuid
category_id	uuid FK
name	varchar
description	text
created_at	timestamptz

Example:

{
  "category_id": "...",
  "name": "Physics"
}
questions

Core content table.

questions
Column	Type
id	uuid
category_id	uuid
subcategory_id	uuid
question_text	text
answer	text
explanation	text
difficulty	smallint
source	varchar
active	boolean
created_at	timestamptz

Difficulty:

1 = Easy
2 = Medium
3 = Hard

Example:

{
  "question_text": "Which country has the longest coastline?",
  "answer": "Canada",
  "difficulty": 2
}

Indexes:

(category_id)
(subcategory_id)
(active)
question_aliases

Useful for future answer validation.

Example:

Question:

United States

Accept:

USA
US
United States of America

Schema:

question_aliases
Column	Type
id	uuid
question_id	uuid
alias	varchar
training_sessions

Represents one training run.

training_sessions
Column	Type
id	uuid
user_id	uuid
mode	varchar
started_at	timestamptz
completed_at	timestamptz

Modes:

daily
review
custom
question_attempts

Most important table.

Every answered question generates one row.

question_attempts
Column	Type
id	uuid
session_id	uuid
user_id	uuid
question_id	uuid
correct	boolean
response_time_ms	integer
answered_at	timestamptz

Indexes:

(user_id)
(question_id)
(answered_at)
(user_id, question_id)

This table drives:

Statistics
Weakness tracking
Spaced repetition
user_question_stats

Denormalized cache table.

Without this, statistics become expensive.

user_question_stats
Column	Type
user_id	uuid
question_id	uuid
total_attempts	integer
correct_attempts	integer
incorrect_attempts	integer
last_seen_at	timestamptz
mastery_score	numeric

Example:

{
  "total_attempts": 5,
  "correct_attempts": 4,
  "mastery_score": 0.8
}
user_category_stats

Tracks strengths/weaknesses.

user_category_stats
Column	Type
user_id	uuid
category_id	uuid
attempts	integer
correct	integer
accuracy	numeric
weakness_score	numeric
updated_at	timestamptz

Example:

{
  "accuracy": 0.42,
  "weakness_score": 7.8
}

This table is used during question selection.

user_subcategory_stats

Same concept but more granular.

user_subcategory_stats
Column	Type
user_id	uuid
subcategory_id	uuid
attempts	integer
correct	integer
accuracy	numeric
weakness_score	numeric
review_items

Spaced repetition queue.

review_items
Column	Type
id	uuid
user_id	uuid
question_id	uuid
repetition_count	integer
interval_days	integer
next_review_at	timestamptz
last_reviewed_at	timestamptz
created_at	timestamptz

Example:

{
  "repetition_count": 3,
  "interval_days": 14,
  "next_review_at": "2026-06-18"
}

Indexes:

(user_id, next_review_at)

Critical because every daily session starts with:

SELECT *
FROM review_items
WHERE user_id = ?
AND next_review_at <= NOW()
daily_progress

Makes streak calculations easy.

daily_progress
Column	Type
user_id	uuid
date	date
questions_answered	integer
correct_answers	integer
completed_goal	boolean

Example:

{
  "date": "2026-06-04",
  "questions_answered": 25,
  "completed_goal": true
}
Content Import (Highly Recommended)

Since quiz content is the hardest part of the project, I'd add:

question_sources
Column	Type
id	uuid
name	varchar
source_url	text
imported_at	timestamptz

Then:

questions.source_id

This helps manage future imports from PubQuiz archives, Open Trivia DB, custom CSV files, etc.

Tables I'd Actually Build for V1

Must-have:

users
categories
subcategories
questions
training_sessions
question_attempts
review_items

Performance/statistics layer:

user_question_stats
user_category_stats
user_subcategory_stats
daily_progress

Everything else can be added later.

That's only 10 tables, which is very manageable for a solo project and should comfortably support tens of thousands of questions and thousands of users.