This file contains ideas that could allow us to monetize the app or getting more users.

1. Premium functionality - user can generate questions from the category he want. user can type short prompt on what he would like to imporve on. we built multi-step AI pipeline that generates the questions, conduct a factuality check, refines the questions to be stylistically and spellingly correct. also we should create "check also" - with links to wikipedia and "related facts" with 2-4 facts that will help the user remember the question more. we also want to store this data so that the can resume the session and we dont waste AI tokens regerating the same data every time. we also want those questions to be available to all premium users(we need to consider how, also need to flag them as unverified)

---

## Assessment & conclusions (premium AI generation)

**Verdict:** viable as a premium *add-on*, not as the headline value. Position it as
**"unlimited drilling volume on weak areas"** (more SRS reps on a topic), NOT as
"better questions." AI trivia is a commodity; the authentic 1z10/Milionerzy/PubQuiz
archive is the real moat. The premium framing that's honest and defensible: when the
archive only has 15 questions on Polish kings, generation lets a user grind 200.

**Translation success does NOT de-risk generation.** We translated openTDB to Polish
well, but translation *preserves* an already-verified fact (the source question encoded
a true fact — almost nowhere for hallucination to enter). Generation *invents* new
factual claims from the model's parametric memory, which is exactly where hallucination
lives. Good translation only proves the model writes good Polish — not that it states
true facts.

**Why factuality risk is acute here specifically:**
- Competitive quiz players are the most pedantic, knowledgeable users alive — they catch
  a wrong date/"first person to…" instantly, and one bad question erodes trust fast.
- Polish-specific content is the model's *weakest* area and the users' *strongest* — the
  worst possible overlap. LLMs hallucinate most on niche Polish history/geography/culture.
- Training on a wrong fact is **negative value**, not zero — we'd be teaching incorrect
  answers for a competition. Uniquely bad for a *training* app.

**The fix — retrieval-first (grounded) generation.** The original sketch treats Wikipedia
links as *output decoration*. Flip it: make retrieval the **input** to generation.

```
prompt ("chcę poćwiczyć polskich noblistów")
  -> RETRIEVE  : pull Wikipedia/source passages on the topic   (the real grounding step)
  -> GENERATE  : write questions whose answers are stated in the retrieved text
  -> VERIFY    : 2nd model checks the answer is literally supported by the source
                 (must cite the supporting sentence)
  -> REFINE    : style/spelling pass; build "related facts" FROM the same source
  -> STORE     : cache, flag unverified, semantic (not exact-match) dedup
```

The verifier checks **grounding** ("is the answer in the source?"), which LLMs do far
more reliably than judging **truth** ("is this true?"). A pure LLM-as-judge pass with no
source is weak — judges hallucinate too. Grounding also makes the "check also" links
*honest*: they're the actual sources the question came from.

**Shared pool raises the stakes.** Caching generated questions and serving them to all
premium users is smart for token cost, but it means one bad question now pollutes
*everyone*. Therefore:
- The grounding pipeline becomes mandatory, not optional.
- Need semantic dedup (not exact-match) or the pool fills with near-duplicates.
- Lean on the already-designed `verification_status` + "zgłoś błąd" error-report workflow
  as the safety net — our competitive users are a free, motivated QA army.

**Don't launch on hope — measure.** Treat factuality as a metric, not an aspiration:
- Sample N generated questions, human-score factual accuracy on Polish content, and gate
  the paid tier behind a bar (target >95% before charging).
- Measure tokens-per-*accepted* question (after the verify-pass reject rate) before
  promising the feature economically.

**Sequencing:** ship the free archive + SRS first (the moat, already built); add grounded
generation as the premium drilling tier afterward. See [DATA_SOURCING.md](DATA_SOURCING.md)
for how to acquire the archive content.