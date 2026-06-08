# 📄 Chief-AI-Arti — Product Requirements Document
**Version:** 2.0 — Phase 1 (Corrected & Final)
**App Name:** Chief-AI-Arti
**Tagline:** "Aaj kya banao?"
**Platform:** Next.js PWA (Web + Android installable)
**Target Users:** Homemakers across North India
**Phase 1 Scale:** 15 users max | 1.5 months
**Pricing:** Free tier + ₹150/month paid

---

## 1. 🎯 Product Vision

Chief-AI-Arti is a **Hinglish-first AI kitchen companion** for North Indian homemakers. It solves the single most repeated daily frustration — "aaj ghar mein kya banao?" — using a curated recipe database, AI-powered fridge scanning, and a floating cooking assistant chatbot.

It is **not** a health app, calorie tracker, or diet planner. It is a **recipe companion** with smart context presented in a fun, non-intimidating way. The experience should feel like asking a knowledgeable bahu/saheli who knows every North Indian recipe and speaks in friendly Hinglish.

---

## 2. 🤖 AI Model Strategy (Final — No Claude)

| Task | Dev/Testing | Production |
|---|---|---|
| Fridge image scan | `gpt-4o-mini` | `gpt-5-mini` |
| AI chatbot responses | `gpt-5-mini` | `gpt-5-mini` |
| Chat session summary/compression | `gpt-4o-mini` | `gpt-4o-mini` |
| Recipe embeddings | `text-embedding-3-small` | `text-embedding-3-small` |
| Thumbnail AI generation | ❌ Phase 2 only | `gpt-image-1-mini` |

**Rules:**
- No Anthropic/Claude API at any point
- Single OpenAI API key for all models
- GPT-4o-mini handles short, cheap tasks (summaries, image in dev)
- GPT-5 mini handles quality-critical tasks (chat, vision in prod)
- GPT Image 1 Mini is Phase 2 only — not imported in Phase 1

---

## 3. 👤 Primary User Persona

**Name:** Sunita Devi / Rekha Sharma (composite)
**Age:** 35–55
**Location:** North India — UP, Bihar, MP, Delhi NCR, Rajasthan, Haryana, Uttarakhand
**Device:** Android smartphone, mid-range, Chrome browser
**Tech comfort:** Low — uses WhatsApp, YouTube. No habit of app stores.
**Language:** Hindi primary, some Hinglish
**Daily problem:** Decides what to cook 3× a day. Forgets steps mid-cook. Wastes leftovers.
**Motivations:** Good food for family, no wastage, variety, quick meals
**Fears:** Complex UI, English-only apps, calorie guilt

---

## 4. 🗺️ User Journey (Full Flow)

```
Opens URL in Chrome
        ↓
Direct to Login Screen (no landing page — redirect immediately)
  → Phone OTP  OR  Google Login (via Clerk)
        ↓
First time? → Onboarding (3 questions)
Returning?  → Home feed directly
        ↓
Home Feed → Browse recipes / Fridge scanner / Chat
        ↓
Recipe Detail → Steps / TTS / Portion slider / Floating chat
        ↓
Hits free limit → Inline upgrade CTA in Hinglish
        ↓
Razorpay payment → ₹150/month subscription activated
        ↓
Paid user → All Phase 1 paid features unlocked
```

---

## 5. 🎯 Phase 1 Feature Set

### ✅ Free Features
- Browse recipe feed — **10 recipes/day limit**
- Full recipe detail (ingredients, steps, cook time, vibe tags)
- 3 AI chat messages/day (floating chatbot)
- 2 Fridge scans/day
- Vrat mode toggle (global, instant)
- Hinglish TTS on every recipe step (Web Speech API — zero cost)
- Portion slider: 2 → 6 people

### 💎 Paid Features — ₹150/month
- Unlimited recipe browsing
- Unlimited AI chatbot messages
- Unlimited fridge scans
- Portion slider: 2 → 15 people
- WhatsApp recipe share (1-tap)
- Cooking history — last 30 days ("Kya kya banaya")

### 🚫 NOT in Phase 1 (Phase 2 only)
- Bacha Hua (Leftover) mode
- Food Recipe Library / visual grid
- AI-generated recipe thumbnails (GPT Image 1 Mini)
- Web Push notifications
- Meal planner
- Admin panel
- Analytics

---

## 6. 📱 Screen Inventory

### 6.1 Login Screen (`/sign-in`)
- Clerk-powered, OTP + Google only. No email/password.
- Two options: "Phone se login karo" | "Google se login karo"
- On success → check `onboarding_done`
  - false → `/onboarding`
  - true → `/home`
- Root `/` immediately redirects to `/sign-in` if unauthenticated

---

### 6.2 Onboarding (`/onboarding`)
**3 questions. No skipping. Forward-only.**

**Q1: Aapke ghar mein kya chalta hai?** (single select)
- 🥦 Pure Veg
- 🥚 Egg bhi chalti hai
- 🍗 Non-veg bhi banta hai

**Q2: Koi khaas parhez hai?** (multi-select, optional)
- Dairy nahi | Gluten nahi | Mungfali nahi | Kuch nahi

**Q3: Aap kiske liye banati hain?** (single select)
- Sirf apne liye (1-2 log)
- Chhota parivar (3-5 log)
- Bada parivar (6+ log)

On submit → save `diet_type`, `restrictions`, `family_size` to `users` table → set `onboarding_done = true` → init Redis chat session key → `/home`

**Acceptance Criteria:**
- [ ] Cards min 64px height, full-width tap area
- [ ] Submit disabled until Q1 + Q3 answered
- [ ] No back button
- [ ] Completes in under 30 seconds

---

### 6.3 Home Feed (`/home`)

**Sections (top → bottom):**
1. Header bar: "Namaskar, [name]! 🙏" + Vrat toggle (top-right)
2. Quick action strip: 📷 Fridge Scan | 🎲 Surprise karo!
3. Recipe feed: vertical scroll, cards filtered by diet_type + vrat_mode + not cooked in last 3 days

**Recipe card shows:** thumbnail, name (Hinglish), vibe tags, cook time
**Vibe tags are FREE** — visible to all users (they are recipe metadata, not a paid feature)

**Free limit:** 10 cards/day. After 10th card, an inline upgrade card appears in the feed — not a modal.

**Vrat Toggle behaviour:**
- Saved to `users.is_vrat_mode` on every toggle
- Instantly re-filters feed (Zustand state update → re-query)
- Appends saatvik constraint to all AI prompts when ON

**Acceptance Criteria:**
- [ ] Feed loads < 2 seconds
- [ ] Toggle updates feed without page reload
- [ ] Free limit counter NOT shown — silently blocks at 10
- [ ] Upgrade card appears inline at position 11 in feed
- [ ] "Surprise karo!" picks random recipe not cooked in last 7 days

---

### 6.4 Recipe Detail (`/recipe/[id]`)

**Sections:**
- Hero: full-width thumbnail + name in large Hinglish text
- Info strip: cook time | vibe tags | meal type
- Portion slider
- Ingredients list (recalculates with slider)
- Steps (numbered, TTS per step)
- Fixed bottom bar: actions
- Floating chat button (bottom-right, always visible)

**Portion Slider:**
- Free: 2 → 6 people
- Paid: 2 → 15 people
- Recalculates client-side (zero API call)

⚠️ **Portion Scaling — Non-Linear Rule (Important)**

A simple 1:1 multiplier is WRONG for Indian cooking. Salt, oil, and spices do not scale linearly.

```
Scaling rules for ingredients:
  Main ingredients (sabzi, dal, chawal):  scale linearly with ratio
  Salt:        scale at 70% of linear ratio (taste saturates)
  Oil/Ghee:    scale at 60% of linear ratio (taste + health)
  Spices (haldi, mirch, garam masala): scale at 65% of linear ratio
  Water:       scale linearly only up to 2×, then cap
  Whole spices (tej patta, laung):  do NOT scale — stay fixed

Display a note below scaled ingredients:
  "⚠️ Namak aur masala thoda thoda milao — taste karte jaiye!"
```

**Ingredients list format:** `[qty] [unit] [name]` e.g. "2 katori Aloo (cubed)"

**Unit toggle** (from profile settings):
- Desi: katori, chammach, pinch (default)
- Metric: grams, ml, tsp

**TTS:** Web Speech API, per-step. Reads in Hindi voice if available.

**Fixed bottom bar:**
- 📤 WhatsApp pe bhejo [PAID — tooltip for free users]
- 🍳 Bana liya! → adds row to `cooking_history` + increments `recipe.cooked_count`

**Acceptance Criteria:**
- [ ] Slider recalculates all quantities client-side
- [ ] Non-linear scaling applied to salt/oil/spices
- [ ] Warning note shown when portion > base_family_size
- [ ] TTS reads one step at a time, not full recipe
- [ ] WhatsApp button shows tooltip for free users, not hard block
- [ ] Recipe page cacheable by PWA service worker

---

### 6.5 Fridge Scanner (`/fridge`)

**Step 1 — Image capture**
- Big camera icon: "Fridge ki photo lo 📷"
- Options: Camera (mobile) | Upload (desktop)
- Client-side compression: max 800px width before upload
- Upload to S3 via pre-signed URL

**Pre-upload validation (client-side):**
- File must be image (MIME check)
- File size must be < 10MB
- If fails: "Yeh file sahi nahi hai. Photo lo ya image upload karo."

**Step 1.5 — Server-side image validation (NEW)**
Before running ingredient extraction, validate the image with GPT-4o-mini (dev) / GPT-5-mini (prod):
```
Prompt: "Is this a photo of a refrigerator, kitchen, or food ingredients?
         Reply with JSON: {valid: boolean, reason: string}"
```
- If `valid: false` → return friendly error, do NOT proceed to extraction
- Error: "Yeh fridge ki photo nahi lagti! Sahi photo lo 📸"
- Blurry/dark photo: "Photo thodi saaf lo, roshni thodi aur chahiye ☀️"

**Step 2 — Ingredient chips**
- GPT returns: `[{name: "Aloo", confidence: 0.95}, ...]`
- High confidence (≥0.8): normal chip
- Low confidence (<0.8): chip with ❓ prefix
- User can: tap ✕ remove | "+ Aur add karo" type extras
- Confirm: "Haan, yahi sahi hai ✓"

**Step 3 — Search results**
- Confirmed ingredients → RAG search
- Show top 3 recipe cards
- If 0 results → graceful empty state (no AI generation)

**Free limit:** 2 scans/day (Upstash Redis)

**Acceptance Criteria:**
- [ ] MIME + size check before upload
- [ ] Server validation rejects non-food/non-fridge images
- [ ] Low-confidence chips visually distinct (❓ prefix + muted color)
- [ ] Confirm button disabled until at least 1 chip remains
- [ ] Loading: "Dekh rahi hoon fridge mein... 👀" (~3-5 sec)
- [ ] Scan limit blocked with upgrade CTA, not generic error

---

### 6.6 Floating AI Chatbot

**Trigger:** Floating button (bottom-right) on `/recipe/[id]`

**Chat Window:** Bottom sheet, 60% screen height
- Header: "Chef Arti se poochho 🍳"
- Input: text field + send
- Free: 3 messages/day (Redis)
- After limit: "Aaj ke sawaal ho gaye! ₹150/mein unlimited poochho 😊"

**Memory — Redis-only, ephemeral:**
```
Redis Key:   chat:{userId}
TTL:         10800 seconds (3 hours, refreshed on each message)
Payload:     {
  compressed_memory: {
    current_recipe: string,
    family_size: number,
    cooking_progress: string,
    notes: string
  },
  recent_messages: []  // last 5 only
}
```
Session auto-deletes after 3 hours. No Supabase storage. No cron job needed.

**Every GPT-5 mini call structure:**
```
[System prompt ~300 tokens]   ← static, cached
[Compressed memory ~100 tokens] ← from Redis
[Last 5 messages ~200 tokens]   ← from Redis
[Current message]

Total: ~600-700 tokens per call ✅
```

**System prompt:**
> ⚠️ The prompt embedded in this section is obsolete. See `scripts/seed/system-prompt.txt` (v2) — that file is authoritative. The v2 prompt uses respectful "aap", retrieval-grounding rules (`{retrieved_recipe}`, `{retrieved_knowledge}`), ambiguity handling, and cooking-progress awareness. Do not regenerate this section from memory — read the file.

**Session compression trigger:** After every 5 messages, GPT-4o-mini compresses context into `compressed_memory` JSON. This keeps token usage flat regardless of conversation length.

**Acceptance Criteria:**
- [ ] Chat opens as bottom sheet without page reload
- [ ] Recipe context auto-loaded when opened from recipe page
- [ ] Session persists within 3-hour window (Redis TTL refreshed on each message)
- [ ] Clean slate after 3 hours
- [ ] AI never responds in pure English
- [ ] Compression runs after msg 5, 10, 15... silently

---

### 6.7 Profile & Settings (`/profile`)

**Sections:**
- Name + phone (display only)
- Subscription status: Free / Premium (active till [date])
- Upgrade button (free users) → Razorpay
- Manage/cancel (paid users)
- Settings:
  - 📏 Units: Desi (katori) / Metric (grams)
  - 🥛 Diet type (editable)
  - 👨‍👩‍👧 Default family size
- Cooking history [PAID]: last 30 days, reverse chronological

---

## 7. 🔄 Business Rules

### 7.1 Free Tier Limits (Upstash Redis)

| Feature | Free | Paid |
|---|---|---|
| Recipe browse | 10/day | Unlimited |
| AI chat | 3/day | Unlimited |
| Fridge scan | 2/day | Unlimited |
| Portion slider | 2–6 people | 2–15 people |
| Vibe tags | ✅ Free | ✅ Free |
| WhatsApp share | ❌ | ✅ |
| Cooking history | ❌ | ✅ |

**Redis rate limit keys:**
```
rate:{userId}:recipes:{YYYY-MM-DD}  → integer, midnight reset
rate:{userId}:chat:{YYYY-MM-DD}     → integer, midnight reset
rate:{userId}:scan:{YYYY-MM-DD}     → integer, midnight reset
```

### 7.2 Vrat Mode Rules
When `is_vrat_mode = true`:
- SQL: `WHERE is_vrat_friendly = true` on all recipe queries
- All GPT prompts append saatvik constraint
- Fridge scan results also filtered
- Persisted to DB on toggle

### 7.3 Subscription (Razorpay)
- ₹150/month (15000 paise), monthly recurring
- Grace period: 0 days
- Webhook events:
  - `subscription.activated` → status='paid', set ends_at
  - `subscription.charged` → extend ends_at + 1 month
  - `subscription.cancelled` → keep access till ends_at
  - `subscription.expired` → status='free'
- All payloads verified via HMAC + `RAZORPAY_WEBHOOK_SECRET`

---

## 8. 🔍 RAG Search Spec

**Input:** Confirmed ingredient array OR text query

**Pipeline:**
```
Step 1 — SQL pre-filter (no vectors, fast)
  WHERE diet_type = user.diet_type
  AND (is_vrat_friendly = true OR vrat_mode = false)
  AND NOT (excluded_items && user.restrictions)

Step 2 — Embed query
  text-embedding-3-small (OpenAI)
  Input: ingredients joined as comma string

Step 3 — pgvector cosine search
  On pre-filtered rows only
  LIMIT 10, ORDER BY embedding <=> query_vector

Step 4 — Re-rank
  Boost: not in cooking_history last 7 days
  Boost: seasonal tags match current month
  Pick top 3

Step 5 — Return or graceful empty state
  ≥1 result: return top 3 recipe cards
  0 results: show empty state + trigger CASE 2 if enabled (saves to recipes_pending)
```

**Empty state (0 results):**
```
UI: "Yeh combo nahin mila abhi! 🙁
     Kuch aur try karo, ya in recipes mein se dekho:"
     → show top 5 most-cooked recipes as fallback suggestions
     → show search bar to try a different query
```

**Edge cases:**
- 0 ingredients confirmed → "Kuch toh daalo!" — no search triggered
- Network failure on embed → retry once → fallback to `cooked_count DESC` top 10

---

## 9. ⚠️ Error States (Hinglish)

| Situation | Message |
|---|---|
| Recipe limit reached | "Aaj ke recipes ho gaye! Kal aur dekhna 😊" |
| Chat limit reached | "Aaj ke 3 sawaal ho gaye! ₹150/mein unlimited poochho" |
| Scan limit reached | "Aaj 2 scans ho gaye! Kal phir aana" |
| No recipes found | "Yeh combo nahin mila! Kuch aur try karo 🙁" |
| Non-food image uploaded | "Yeh fridge ki photo nahi lagti! Sahi photo lo 📸" |
| Blurry/dark image | "Photo thodi saaf lo, roshni chahiye ☀️" |
| Invalid file type | "Sirf photo upload karo — yeh file nahi chalegi" |
| AI response timeout | "Thodi der mein phir try karo. Arti thak gayi 😅" |
| Payment failed | "Payment nahi hui. Dobara try karo ya bank se poochho" |
| Network error | "Internet check karo, phir try karo" |
| Vrat mode, no vrat recipes | "Aaj vrat ke recipes kam hain! Jaldi aur add karenge 🙏" |

---

## 10. 🎨 Design System

### Colors
```css
--primary:    #E8640C;   /* Saffron orange — CTAs, active states */
--primary-lt: #FFF0E6;   /* Light saffron — card backgrounds */
--accent:     #2D6A4F;   /* Fresh green — success, vrat indicator */
--text:       #1A1A1A;   /* Near black — body */
--muted:      #8B7355;   /* Warm brown — secondary text */
--surface:    #FFFDF9;   /* Warm white — page background */
--border:     #E8DDD0;   /* Warm border */
--danger:     #C0392B;   /* Error states */
```

### Typography
```
Display: Noto Sans Devanagari (Hindi text, headings)
Body:    Poppins (Hinglish Latin, UI labels)

xs:  12px  — badges, timestamps
sm:  14px  — secondary info
md:  16px  — body, ingredients
lg:  20px  — section headings
xl:  28px  — recipe hero name
2xl: 36px  — home greeting
```

### UX Constraints (Non-negotiable)
```
✅ All tap targets: min 48×48px
✅ Bottom navigation: 4 tabs only
✅ Icons + text labels together — no icon-only nav
✅ Max 4 options per choice screen
✅ Every visible string in Hinglish
✅ One primary CTA per screen (orange, full width)
✅ Inline upgrade prompts — never blocking modals
✅ Vibe tags visible to all users (free + paid)
❌ No hamburger menu
❌ No horizontal scroll on mobile
❌ No calorie numbers anywhere
❌ No form with more than 2 fields visible at once
❌ No landing/marketing page — direct to login
```

### Bottom Navigation
```
🏠 Ghar      → /home
🔍 Dhundhon  → /search
📷 Fridge    → /fridge
👤 Main      → /profile
```

### Thali Vibe Badges (Free for all users)
```
🌿 Halki Dish      — light, easy on stomach
💪 Taakat Wali     — protein-rich
⚡ Jaldi Bane      — under 20 minutes
❤️ Bacchon Ki Fav  — kid-friendly, mild
🎉 Tyohar Special  — festival recipe
🔥 Teekha Alert    — spicy
🍃 Vrat Wali       — fasting-friendly
```

---

## 11. 📁 Folder Structure

```
chief-ai-arti/
├── app/
│   ├── (auth)/
│   │   └── sign-in/page.tsx         → Clerk OTP + Google login
│   ├── onboarding/page.tsx           → 3 questions
│   ├── (main)/
│   │   ├── layout.tsx               → Bottom nav (4 tabs)
│   │   ├── home/page.tsx            → Recipe feed + Vrat toggle
│   │   ├── recipe/[id]/page.tsx     → Detail + TTS + slider + chat
│   │   ├── fridge/page.tsx          → Scanner flow (3 steps)
│   │   ├── search/page.tsx          → Text search on recipe DB
│   │   └── profile/page.tsx         → Settings + subscription
│   ├── api/
│   │   ├── recipes/
│   │   │   ├── search/route.ts      → RAG hybrid search
│   │   │   └── [id]/route.ts        → Single recipe fetch
│   │   ├── fridge/
│   │   │   ├── validate/route.ts    → Image validation (GPT vision)
│   │   │   └── scan/route.ts        → S3 presign + ingredient extraction
│   │   ├── chat/
│   │   │   ├── message/route.ts     → GPT-5-mini + Redis memory
│   │   │   └── session/route.ts     → GET/DELETE Redis session
│   │   └── subscription/
│   │       ├── create/route.ts      → Razorpay sub
│   │       ├── status/route.ts      → Check subscription
│   │       └── webhook/route.ts     → Razorpay events
│   ├── layout.tsx                    → Root (Clerk provider, fonts)
│   └── page.tsx                      → Redirect to /sign-in
├── components/
│   ├── ui/                          → shadcn/ui
│   ├── RecipeCard/
│   ├── FloatingChatButton/
│   ├── ChatWindow/
│   ├── PortionSlider/               → Non-linear scaling logic here
│   ├── IngredientChips/
│   ├── VibeBadges/
│   ├── VratToggle/
│   ├── TTSButton/
│   └── WhatsAppShare/
├── lib/
│   ├── supabase.ts
│   ├── openai.ts                    → GPT-5-mini + GPT-4o-mini wrapper
│   ├── embeddings.ts                → text-embedding-3-small (OpenAI)
│   ├── rag.ts                       → Hybrid search + graceful empty state
│   ├── memory.ts                    → Redis session CRUD + compression
│   ├── rate-limit.ts                → Upstash rate limiting (₹150 CTA)
│   ├── portion.ts                   → Non-linear scaling calculations
│   ├── razorpay.ts
│   └── s3.ts
├── hooks/
│   ├── useChat.ts
│   ├── useVratMode.ts
│   ├── usePortionSize.ts
│   ├── useTTS.ts
│   └── useSubscription.ts
├── store/
│   └── appStore.ts                  → Zustand (vrat, portion, unit pref)
├── scripts/
│   └── seed-recipes.ts              → Bulk insert 150 recipes + embeddings
└── middleware.ts                     → Clerk: protect /api/* and /(main)/*
```

---

## 12. ⚙️ Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI (all models — one key)
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4o-mini           # dev
# OPENAI_VISION_MODEL=gpt-5-mini          # switch for production
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_SUMMARY_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=chief-arti-fridge-scans

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 13. 💰 Phase 1 Cost Breakdown (15 users)

| Service | Plan | Est. Cost/month |
|---|---|---|
| Vercel | Free (Hobby) | ₹0 |
| Supabase | Free (500MB) | ₹0 |
| Clerk | Free (10k MAU) | ₹0 |
| Upstash Redis | Free (10k cmd/day) | ₹0 |
| AWS S3 | ~50MB images | ~₹20 |
| GPT-4o-mini | Dev vision + summaries | ~₹20 |
| GPT-5 mini | Chat (15 users × 20 calls/day) | ~₹130 |
| text-embedding-3-small | Seed + queries | ~₹10 |
| Razorpay | 2% per transaction | Per sale |
| **TOTAL** | | **~₹180-200/month** |

**Revenue at 5 paid users:** ₹150 × 5 = ₹750/month. Profitable from user 1.

---

## 14. 🧪 Top 10 Acceptance Criteria (Must-pass before launch)

1. User logs in via phone OTP in under 60 seconds
2. Onboarding 3 questions complete, saved, lands on home feed
3. Home feed shows 10 recipes filtered by diet + vrat mode
4. Vrat toggle updates feed instantly, no reload
5. Fridge scan: non-food image rejected with friendly message
6. Fridge scan: photo → chips → results in under 10 seconds
7. Portion slider recalculates with non-linear scaling, client-side only
8. AI chat: Hinglish reply in under 5 seconds, Redis session persists 3hr
9. Free user blocked at 3 chat messages with ₹150 upgrade CTA
10. PWA installable on Android Chrome, opens without browser bar

---

## 15. 🚀 Phase 2 (After Phase 1 Revenue)

Build only after Phase 1 users are paying and app is stable:

- **Bacha Hua (Leftover) mode** — GPT-5 mini for suggestions, no auto-save to DB
- **Food Recipe Library** — visual grid of recipe cards with thumbnails
  - Thumbnail priority: user-uploaded cooked photo → AI-generated after 12hr wait
  - User attribution: "Sunita ji ke haathon ka pyaar ❤️" (not "Made by XYZ")
  - Image moderation before publish (GPT-5 mini validation)
  - GPT Image 1 Mini for AI thumbnail generation
- **Web Push notifications** — Vercel cron, morning/evening nudge
- **Meal planner** — weekly auto-planner
- **Admin panel** — recipe management UI (currently: Supabase Table Editor)
- **RAG result caching** — Upstash Redis for frequent queries
- **Analytics** — PostHog free tier
- **Recipe rating system**
- **Voice input in chat**

---

## 16. ⚠️ Known Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Seed data takes too long | High | 50 done, 100 more needed by Session 4. |
| Fridge scanner misidentifies | High | Editable chips always. Never auto-submit. |
| Non-linear scaling feels wrong | Medium | Show warning note. Let user adjust manually. |
| iOS PWA service worker quirks | Medium | Test Android first. iOS is Phase 2 concern. |
| Razorpay test → live forgotten | Medium | Checklist item in deploy step. |
| GPT-5 mini vision quality gap | Low | Keep gpt-4o-mini as env fallback. One variable change. |
| ₹150 too cheap vs AI cost | Medium | Monitor per-user cost week 2. Raise to ₹199 if needed. |

---

*PRD Version 2.0 | Chief-AI-Arti | Phase 1 Final | Built with ❤️ for Arti ji*
