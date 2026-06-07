# Knowledge Base — Expansion Workflow

This document describes how to safely grow `knowledge.json` and `recipes.json` over time, using a mix of LLMs (ChatGPT, Gemini, DeepSeek) and human curation. **Never** dump raw model output into the seed files.

---

## 1. Core principles

1. **One intent per chunk.** A chunk has one problem and one fix, one ingredient and one substitution, or one tip on one technique. If a draft has "and also..." or "alternatively...", split it.
2. **Human curation gate.** Every chunk an LLM produces must be read end-to-end by a human before it lands in `knowledge.json`. No bulk dumps.
3. **Tone is non-negotiable.** Respectful "aap"/"dijiye"/"karein" — never "tu"/"kar le". Warm mummy/didi/aunty energy, not robotic, not Instagram chef.
4. **Practical realism.** Every quantity, every time, every technique must be true to a real North Indian household kitchen. No restaurant-style instructions, no fantasy substitutions ("instead of paneer, use tofu" — that's not how a ghar wali cooks).
5. **Idempotent IDs.** Chunk IDs are stable slugs (`fix-namak-zyada-aloo`, `sub-tel-ghee`). If you regenerate a chunk, reuse the ID.

---

## 2. Where new chunks come from

### Source A — User-observed gaps (highest priority)
- Cooking history shows users repeatedly asking about "X" with no good retrieval hit → write a chunk for X.
- Empty-state results from RAG search → those queries are gold for KB expansion.
- Chatbot "I don't know" responses (logged) → each one is a candidate KB chunk.

### Source B — Seasonal calendar
- Festival approaching? Audit related chunks 2 weeks ahead.
- Season change (garmi → barsaat, sardi → spring) → review seasonal chunks for currency.

### Source C — Regional gaps
- App user base shows skew (e.g. 40% Bihar) → write Bihar-specific chunks (litti, sattu, thekua).
- Current corpus is `pan-north-indian` heavy — expand regional depth.

### Source D — Bulk LLM expansion (controlled)
Use sparingly. Workflow below.

---

## 3. LLM-assisted drafting workflow (the rigorous version)

### Step 1 — Generate candidates (3 LLMs, separately)
Prompt each model **independently** with the same template:

```
You are a warm North Indian ghar ki didi/aunty writing kitchen knowledge for
a recipe app. Output 5 candidate chunks for the topic: "<TOPIC>".

Each chunk MUST follow this shape (JSON):
{
  "id": "<kebab-case-slug>",
  "type": "<substitution|emergency_fix|seasonal|festival|tip|technique|glossary>",
  "intent": "<5-12 word verb phrase, English+Hinglish OK>",
  "problem": "<how a real user phrases the problem in Hinglish>",
  "applies_to": [<recipe categories or "general">],
  "ingredient_required": "<single ingredient slug, or null>",
  "topic": "<4-10 word Hinglish title>",
  "tags": [<4-8 lowercase kebab-case tags>],
  "content": "<50-120 words, Hinglish, ONE intent only>",
  "preference_order": <1-9, 1=primary>
}

TONE: Respectful "aap"/"dijiye". Warm didi energy. No "tu". No restaurant chef
vocabulary. No "calorie chhod" type lines. Subtle health awareness OK, no
lectures. Max 1 emoji per chunk (usually zero).

Output as a JSON array. No prose outside the array.
```

Run this against:
- **ChatGPT (GPT-5 mini)** — best for Hinglish naturalness
- **Gemini** — strongest on regional/cultural specifics
- **DeepSeek** — good for technique/timing detail

You now have ~15 candidates per topic.

### Step 2 — Dedupe + merge
- Drop near-duplicates (cosine similarity > 0.85 against existing chunks).
- Where two LLMs hit the same intent with different angles, keep the better-written one (rarely merge — merging defeats the one-intent-per-chunk rule).

### Step 3 — Human curation pass
For each surviving candidate, the curator checks:
- [ ] Is the tone right? Read aloud. Does it sound like a real aunty?
- [ ] Are quantities and times specific and realistic?
- [ ] Single intent? (If you can split it into 2, you should.)
- [ ] Does the `problem` field match how users actually phrase this?
- [ ] Are `applies_to` and `ingredient_required` accurate?
- [ ] Is `preference_order` honest? (1 = the one you'd actually recommend first)
- [ ] No banned phrases ("calorie chhod", "tu kar", restaurant terminology)
- [ ] ID is unique — `jq '[.[] | .id] | .[]' scripts/seed/knowledge.json | sort | uniq -d` should be empty after adding.

### Step 4 — Insert + re-embed
- Append curated chunks to `knowledge.json`.
- Run seed script with `--dry-run` to verify shape.
- Run live seed script — it embeds and inserts new rows.

### Step 5 — Spot-check retrieval
After insert, hit the chatbot with 3-5 queries that should hit the new chunks. If the new chunks don't surface in top-3, debug:
- Is the `problem` text close to how users actually ask?
- Is `applies_to` correctly set (used in SQL pre-filter)?
- Is the chunk too short / too long?

---

## 4. Recipe expansion workflow

Same shape as knowledge, but bigger and slower:

1. **Source list first.** Don't generate randomly. Build a target list (e.g. "50 more recipes covering Bihari, Bengali, and Uttarakhandi staples").
2. **One LLM per recipe.** Use the highest-quality model (GPT-5 mini) — recipes need accuracy, not variety.
3. **Curator must cook-test or verify** at least 20% of new recipes against a trusted source (Tarla Dalal, mom, regional cookbook). Wrong quantities erode user trust faster than anything else.
4. **Cultural accuracy review** — wrong region_origin, missing soak_required, wrong is_vrat_friendly flag = retrieval/UX bugs.
5. **AI-generated recipes** from runtime CASE 2 fallback go into a separate `source='ai'` bucket. They are NEVER auto-promoted to `source='curated'` without the same human review.

---

## 5. Anti-patterns (do not do these)

- ❌ Bulk-paste 50 LLM-generated chunks without reading each one
- ❌ Generate "comprehensive" multi-intent chunks ("namak zyada hone par 8 fixes")
- ❌ Skip the tone check — bad tone propagates and ruins the app's voice
- ❌ Add fields the schema doesn't have ("Just throwing in `difficulty: 5`")
- ❌ Reuse an existing `id` for a different chunk (breaks retrieval continuity)
- ❌ Forget to update `preference_order` so 5 chunks for the same problem all claim `preference_order: 1`

---

## 6. Re-embedding existing chunks

When you upgrade the embedding model:

```
-- Get all rows with stale embeddings
SELECT id, embedding_text FROM knowledge_docs WHERE embedding_text IS NOT NULL;
```

Loop through, re-embed each `embedding_text` (no re-derivation needed), update the row. The `embedding_text` column is the source of truth — that's why we store it.

A `scripts/reembed.ts` script (Phase 2) will automate this.

---

## 7. Versioning + provenance

- Tag each chunk in commit messages: `kb: add 6 chunks for Bihar litti chokha workflow`
- Keep an `embedding_model` column if you start mixing models. Phase 1: single model, so not needed.
- If you ever change tone direction, audit ALL existing chunks — don't leave drift between old and new chunks.
