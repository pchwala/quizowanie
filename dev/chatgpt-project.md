BELOW ARE THE CONVERSATIONS WITH CHATGPT WITH INITIAL PROJECT DESCRIPTIONS:

-I am planning on app that will help users train for the polish gameshows and quiz games most notably 1z10, milionerzy and PubQuiz. App will be Polish and for polish audience only but our conversation should be in English These are my first notes on features I want to implement: -Fiszki -Dostępne dane z innych teleturniejów -Dodatkowe pytania wygenerowane na podstawie znanych założeń -Mnemonika -mozliwosc zgłoszenia błędu - pytanie wypada na czas weryfikacji -AI weryfikacja pytań -Kategorie do wyboru lub losowo cała baza danych -Konto użytkownika i System powtarzania jak w re-word(flashcard language learning app) -Możliwość dodawania pytań Każde fiszka z oznaczeniem źródła pochodzenia - historyczne dane, input użytkownika, AI -Przemyśleć jak zrobić zaciąganie 15s-30s materiałów audio/video z YT wraz z tytułem filmu/utworu What are your thoughts about this?

-I think this is a stronger idea than it may seem at first glance.

The key insight is that you're not building "another quiz app." You're building a training platform for competitive quiz players. That's a much narrower audience, but they are highly motivated and willing to spend time learning.

The biggest risk is not technology. It's content quality.

What I would prioritize
Phase 1 — Core MVP

I'd focus on:

Historical questions database
Flashcards
Spaced repetition
Categories
User accounts
AI-generated practice questions

Everything else can wait.

A user should be able to:

Select category/categories
Study flashcards
Mark answer quality
Review according to SRS
Generate more questions in weak areas

That's already valuable.

Question Sources

Your idea of source tagging is very important.

Each question should have:

Question
Answer

Source:
- 1z10 archive
- Milionerzy archive
- PubQuiz archive
- User submission
- AI generated

Verification status:
- Verified
- Pending review
- Rejected

This helps solve trust issues.

If I get a weird AI-generated question, I immediately know why.

AI Verification

I would be careful here.

AI should not be the final verifier.

Instead:

User submits question
        ↓
AI checks:
- factual consistency
- duplicates
- spelling
- category
- source credibility
        ↓
Human moderation
        ↓
Published

AI can reduce moderator workload by 80%.

It should not be the ultimate authority.

Feature I think is missing
Difficulty Rating

Quiz players care about difficulty.

Each question should have:

Difficulty:
1-10

Can be calculated from:

user success rate
answer time
manual moderator rating

Over time:

Capital of France
Difficulty: 1

Who won the 1977 Giro d'Italia?
Difficulty: 8
Feature I think is REALLY missing
Explanation after answer

Most quiz apps fail here.

Instead of:

Q: What is the capital of Australia?
A: Canberra

show:

Canberra

Why?
Sydney and Melbourne competed to become capital.
Canberra was created as a compromise.

People remember stories better than isolated facts.

Mnemonics

Excellent idea.

I would store them separately.

Question
Answer
Explanation
Mnemonic

Example:

Capital of Australia

Answer:
Canberra

Mnemonic:
"Can-bear-a kangaroo"

Users could also submit their own mnemonics.

PubQuiz Mode

I would make this a separate game mode.

Instead of flashcards:

10 random questions
2 music rounds
1 image round
1 geography round

Basically a simulated PubQuiz.

This could become one of the strongest features.

1 z 10 Mode

This is where things become interesting.

You can mimic the actual pressure.

Features:

5 seconds to answer
answer confidence rating
streak tracking
category targeting

Even if the questions aren't identical to the show, the pressure training is valuable.

Milionerzy Mode

Questions should have:

A
B
C
D

and ideally:

50:50
Ask AI audience
Ask AI expert

Not because it's useful, but because it's fun.

Audio / Video Questions

I would avoid storing YouTube clips.

Potential issues:

copyright
videos disappear
licensing

Instead:

Option A

Store:

YouTube URL
Start timestamp
End timestamp

and embed via YouTube player.

Option B

Use YouTube API metadata only.

Safer legally.

Another Feature I'd Add
Fact Network

When a user gets a question wrong:

Marie Curie

show related facts:

Related:
- Pierre Curie
- Radioactivity
- Nobel Prize
- Polonium
- Radium

Quiz champions often learn through connections rather than isolated facts.

Business Perspective

If I were building this today, I'd market it as:

"The Duolingo/Anki for Polish quiz players."

Not:

"A quiz app."

The second has thousands of competitors.

The first has almost none in Poland.

The combination of:

historical TV quiz questions
SRS repetition
AI-generated expansion
mnemonic support
simulated game modes

is genuinely differentiated and could attract:

1 z 10 enthusiasts
PubQuiz teams
trivia hobbyists
people preparing for TV game shows

The content pipeline and verification workflow are likely to determine success far more than the frontend, backend, or AI stack.

Focus on backend logic
Make me a overview description of MVP features

User accounts
Question database
Categories/subcategories
Statistics
Weakness tracking
Daily training mode
Spaced repetition for missed questions