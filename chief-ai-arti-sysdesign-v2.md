# 🍳 Chief-AI-Arti — System Design v2.0
**Version:** 2.0 — Phase 1 Final
**Stack:** Next.js (App Router) + Supabase + Clerk + OpenAI (GPT-5-mini, GPT-4o-mini) + Razorpay + AWS S3 + Upstash Redis
**Scale:** 15 users | 1.5 months | No Claude, No Voyage AI

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│           USER — Next.js PWA (Android Chrome)            │
│              Installable from browser                    │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────┐
│              VERCEL — Next.js App Router                  │
│                                                          │
│  Pages: /home  /recipe/[id]  /fridge  /search  /profile  │
│  API:   /api/recipes/search  /api/fridge/validate        │
│         /api/fridge/scan     /api/chat/message           │
│         /api/chat/session    /api/subscription/*         │
│                                                          │
│  middleware.ts → Clerk auth guard on all /api + /(main)  │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼──────────────────┐
│  Supabase           │   │  External Services            │
│  PostgreSQL         │   │                               │
│  + pgvector         │   │  Clerk     → OTP + Google     │
│                     │   │  OpenAI    → GPT-5-mini       │
│  Tables:            │   │            → GPT-4o-mini      │
│  users              │   │            → text-embed-3-sm  │
│  recipes            │   │  Razorpay  → Subscriptions    │
│  cooking_history    │   │  AWS S3    → Fridge photos    │
│  subscriptions      │   │                               │
│                     │   └───────────────────────────────┘
│  NO chat_sessions   │
│  (Redis handles it) │
└─────────────────────┘
           │
┌──────────▼──────────┐
│  Upstash Redis      │
│  (Serverless HTTP)  │
│                     │
│  Phase 1 only:      │
│  • Rate limiting    │
│  • Chat session TTL │
│                     │
│  Phase 2 adds:      │
│  • RAG result cache │
└─────────────────────┘
```

---

## 🤖 AI Model Strategy

| Task | Dev/Testing | Production |
|---|---|---|
| Image validation + scan | `gpt-4o-mini` | `gpt-5-mini` |
| AI chatbot | `gpt-5-mini` | `gpt-5-mini` |
| Session compression/summary | `gpt-4o-mini` | `gpt-4o-mini` |
| Embeddings | `text-embedding-3-small` | `text-embedding-3-small` |
| Thumbnail generation | ❌ Not in Phase 1 | `gpt-image-1-mini` (Phase 2) |

Model switching via ENV variable — no code change required for prod promotion:
```bash
OPENAI_VISION_MODEL=gpt-4o-mini   # dev → change to gpt-5-mini for prod
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_SUMMARY_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

---

## 🗄️ Database Schema

> **Source of truth:** `chief-ai-arti/scripts/schema.sql` — do not duplicate schema here.
>
> The schema is now significantly richer than the original draft in this document (added: `spice_level`, `cooking_style`, `region_origin`, `heaviness`, `prep_time_minutes`, `soak_required`, `goes_well_with`, `embedding_text`, `source` on `recipes`; full atomic-chunk shape on `knowledge_docs`; `spice_preference`, `disliked_ingredients`, `preferred_region` on `users`; plus the `recipes_pending` table for CASE 2 AI-generated recipes awaiting moderation). Keep the SQL file authoritative — TypeScript types at `src/types/index.ts` mirror it.
>
> What lives in Postgres (Phase 1): `users`, `recipes`, `recipes_pending`, `knowledge_docs`, `cooking_history`, `subscriptions`. No `chat_sessions` table — chat memory is Redis-only (see §Redis Architecture below).

---

## 🔴 Redis Architecture (Phase 1 Only)

```
KEY STRUCTURE:

Rate Limiting:
  rate:{userId}:recipes:{YYYY-MM-DD}   → integer count, TTL until midnight
  rate:{userId}:chat:{YYYY-MM-DD}      → integer count, TTL until midnight
  rate:{userId}:scan:{YYYY-MM-DD}      → integer count, TTL until midnight

Chat Session Memory:
  chat:{userId}                        → JSON payload (see below)
                                         TTL: 10800s (3hr, refreshed per message)

CHAT SESSION PAYLOAD:
{
  "compressed_memory": {
    "current_recipe": "Aloo Gobhi",
    "family_size": 4,
    "cooking_progress": "tadka done, sabzi added",
    "oil_preference": "low oil",
    "notes": "user already added salt"
  },
  "recent_messages": [
    {"role": "user", "content": "Haldi kitni daalun?"},
    {"role": "assistant", "content": "Ek choti chammach kaafi..."},
    ... (max 5 messages)
  ]
}

COMPRESSION TRIGGER:
  After every 5 messages, run GPT-4o-mini to compress full context
  into compressed_memory JSON. Keeps token count flat forever.

UPSTASH FREE TIER:
  15 users × ~20 ops/day = 300 ops/day
  Free limit: 10,000 ops/day → 33× headroom ✅
```

---

## ⚖️ Portion Scaling — Non-Linear Rules

**Do NOT use simple multiplication for all ingredients.**

```
Ingredient type         Scaling factor
──────────────────────────────────────
Main veg/dal/chawal    → ratio × 1.0   (full linear)
Oil / Ghee             → ratio × 0.6   (60% of linear)
Salt                   → ratio × 0.7   (70% of linear)
Haldi / Mirch / Masala → ratio × 0.65  (65% of linear)
Water                  → ratio × 1.0 up to 2× base, then cap
Whole spices           → fixed — do not scale at all
  (tej patta, laung, elaichi, dalchini)

ratio = desired_family_size / base_family_size

Implementation: store scale_type per ingredient in JSONB
  "scale_type": "linear" | "salt" | "spice" | "oil" | "water" | "fixed"

lib/portion.ts handles all scaling logic.
PortionSlider component calls lib/portion.ts — zero API call.

When scaled portion > base_family_size, show warning below ingredient list:
  "⚠️ Namak aur masala thoda thoda milao — taste karte jaiye!"
```

---

## 🔄 RAG Pipeline

```
User: "Aloo, tamatar, pyaz confirm kiya"
           │
  ┌────────▼─────────┐
  │  SQL pre-filter  │  diet_type + vrat_mode + exclusions
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Embed query     │  text-embedding-3-small → 1536-dim vector
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  pgvector search │  cosine similarity on pre-filtered rows
  │  LIMIT 10        │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Re-rank         │  +boost: not in history 7 days
  │  Pick top 3      │  +boost: seasonal tags
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Results ≥ 1?    │──YES──→ Return top 3 recipe cards
  └────────┬─────────┘
           │ NO
  ┌────────▼─────────┐
  │  Graceful empty  │  Show message + top 5 popular fallbacks
  │  NO AI generate  │  NO auto-save to DB
  └──────────────────┘
```

---

## 🖼️ Image Validation Flow (Fridge Scanner)

```
User uploads image
        │
Client-side check:
  MIME type = image/*?    → NO → reject immediately
  File size < 10MB?       → NO → reject immediately
        │ PASS
S3 pre-signed upload
        │
POST /api/fridge/validate
  GPT vision model:
  "Is this a fridge, kitchen, or food ingredients photo?
   JSON: {valid: boolean, reason: string}"
        │
  valid = false → 403 + Hinglish error message
  valid = true  → proceed to ingredient extraction
        │
POST /api/fridge/scan
  Extract ingredients as JSON array with confidence scores
        │
Return chips to client
```

**Two separate API routes** (`validate` then `scan`) keeps responsibilities clean and lets you add moderation logic to validate independently.

---

## 📅 SDLC Build Order

### Week 1 — Foundation
- [ ] `npx create-next-app chief-ai-arti --typescript --tailwind --app`
- [ ] Deps: `next-pwa zustand @clerk/nextjs @supabase/supabase-js @upstash/redis @upstash/ratelimit openai`
- [ ] Clerk: OTP + Google login, middleware protection
- [ ] Supabase: run schema SQL (all tables + indexes)
- [ ] Onboarding: 3-question flow
- [ ] Bottom nav layout (4 tabs)
- [ ] Root redirect: `/` → `/sign-in`

### Week 2 — Recipe Engine
- [ ] Seed 50 recipes via `scripts/seed-recipes.ts` (embeds auto-generated)
- [ ] Home feed: cards, vibe tags, vrat toggle
- [ ] Portion slider: `lib/portion.ts` with non-linear scaling
- [ ] TTS button per step (Web Speech API)
- [ ] Recipe detail page

### Week 3 — AI + Scan
- [ ] Fridge: validate route + scan route (separate)
- [ ] Ingredient chips UI (editable)
- [ ] RAG search + graceful empty state
- [ ] Floating chatbot: Redis session + GPT-5 mini
- [ ] Session compression after msg 5
- [ ] WhatsApp share (paid gate)

### Week 4 — Monetization + Deploy
- [ ] Razorpay: create + webhook routes
- [ ] Rate limiting: Upstash ratelimit library
- [ ] Upgrade CTA UI (inline, not modal)
- [ ] Seed remaining 100 recipes (total 150)
- [ ] PWA manifest + service worker
- [ ] Vercel deploy + set all ENV vars
- [ ] Switch `OPENAI_VISION_MODEL` to `gpt-5-mini` in Vercel ENV

### Buffer (Days 29–45) — Testing
- [ ] Give to mom + neighbors
- [ ] Watch usage without explaining anything
- [ ] Fix top 3 friction points found
- [ ] Verify Razorpay is in LIVE mode (not test)

---

## ⚠️ 5 Non-Negotiable Warnings

1. **Seed data first.** 150 recipes before any code. The app is useless without it.
2. **Validate images server-side.** Do not trust client claims. The validate route must run before scan.
3. **Redis is source of truth for chat memory.** Do not add chat_sessions to Supabase. No duplicate.
4. **Non-linear portion scaling must ship Day 1.** Linear scaling gives wrong amounts for salt/spice. Users will notice.
5. **Razorpay live mode checklist.** Add an explicit "is RAZORPAY_KEY_ID starting with rzp_live_?" check in your pre-deploy checklist.

---

*System Design v2.0 | Chief-AI-Arti | Phase 1 Final*
