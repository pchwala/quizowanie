# Data Sourcing — authentic archive content

The authentic 1z10 / Milionerzy / PubQuiz archive is Quizowanie's real differentiator
(see [MONETIZING_IDEAS.md](MONETIZING_IDEAS.md)). But the data is hard to get.

**Core thesis:** there is no single source. Treat the three shows as **three different
problems**, and **bootstrap rather than boil the ocean** — seed trust with the archive,
then sustain volume via the community submission + error-report + AI-prescreen loop. You
do not acquire all the data upfront.

**Legal stance (chosen): pragmatic.** Scrape broadly for MVP seeding now, transform
heavily, and do a licensing cleanup pass before any paid/public launch.

---

## Milionerzy — easiest, do first

ABCD format maps directly onto the planned Milionerzy mode, and the data is the most
available of the three.

- **Best source — Milionerzy Fandom Wiki (PL):** fans transcribe episodes with
  question + A/B/C/D + correct answer + which lifelines were used. Fandom content is
  **CC-BY-SA 3.0** — legally reusable with attribution + share-alike. This is the single
  best authentic, legal source.
  - https://milionerzy.fandom.com/pl/wiki/Milionerzy
- **Cross-check / current seasons (broadcaster content):** use for verification and
  recent episodes. Pragmatic stance: usable for MVP seeding, transform heavily, revisit
  licensing pre-launch.
  - https://tvn.pl/programy/milionerzy/pytania-z-odcinkow
  - https://www.polsat.pl/news/2025-11-04/milionerzy-poznaj-pytania-i-odpowiedzi-z-odcinka-38/
- Minor/unofficial: a small `kowalskidawid/Milionerzy` GitHub repo (`pytania.json`, no
  license, low quality) — not a primary source.

## 1 z 10 (Jeden z dziesięciu) — hardest, defer

- No official archive. Only tiny student GitHub repos and unverified fan PDFs
  (~1500-question compilations of unknown provenance).
- Authentic content lives in **full episodes on YouTube** → would require Whisper ASR +
  LLM segmentation into Q/A pairs (host reads Q → contestant answers → host confirms is
  an extractable pattern). High effort, noisy. **Defer.**
- **Key insight:** 1 z 10's value is the **format and pressure** (5s timer, streaks),
  NOT unique questions — they're general knowledge. Run "1 z 10 mode" on the general
  pool now and still deliver the experience. Don't block the mode on the show's data.

## PubQuiz — no real archive

- PubQuiz is live pub events; "the PubQuiz archive" in our data model is conceptual.
- Largest Polish community bank: the **IRC Quizbot DB (~116k Polish questions)** on
  quizpl.net — but no stated license/export, so it needs permission or community/manual
  ingest. Other community sources: pubquiz.pl, kenquiz.com, faabul.com.

## General pool (feeds the daily loop + 1 z 10 mode)

- Already have translated openTDB questions. Supplement with community DBs above. This
  pool powers the daily SRS loop and "1 z 10 mode" without needing show-specific data.

---

## Cross-cutting strategy

**Legal (pragmatic).** Individual Q&A facts aren't copyrightable, but the EU/Polish
*sui generis database right* protects a substantial *compiled* database. So don't
bulk-clone any single DB — ingest, transform, mix sources, and attribute CC-BY-SA
(Fandom). Our existing `source` + `verification_status` model already tracks provenance
correctly. Scrape broadly for MVP seeding now; clean up licensing before any paid/public
launch.

**Ingestion pipeline (per source):**

```
per-source parser  ->  normalize to seed JSON                    ->  AI pre-screen        ->  app/seeds/load_questions.py
                       (text, answer, options?, source,              (dedup / spelling /
                        category, explanation)                        category-tag — the
                                                                      same one planned for
                                                                      user submissions)
```

**Priority order:**
1. Milionerzy from Fandom — fast, legal (CC-BY-SA), fits the ABCD mode.
2. General pool from translated openTDB + community DBs — powers daily loop + 1z10 mode.
3. 1 z 10 via YouTube ASR — later, higher-effort project.

**The real moat:** the archive *seeds trust*; the community *sustains volume*. The
answer to "the data is hard to get" is that you bootstrap with the archive and then let
user submissions + error reports + AI pre-screening become the content engine.

---

## Likely next task

A Milionerzy Fandom-wiki scraper/parser that outputs the seed JSON format above — not
built this round (docs only).
