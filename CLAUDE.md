# Chief-AI-Arti

**Tagline:** "Aaj kya banao?"
Hinglish-first AI recipe PWA for North Indian homemakers.

## Stack
- Next.js 16.2.6 (App Router) + TypeScript + Tailwind v4
- Clerk v7 (auth — Google login only)
- Supabase (Postgres + pgvector)
- Upstash Redis (rate limiting + chat session TTL only — no RAG cache in Phase 1)
- OpenAI (vision, chat, embeddings, summaries)
- Razorpay (payments, ₹150/mo paid tier)
- AWS S3 (fridge scan image storage, ap-south-1, bucket `chief-arti-fridge-scans`)

## Phase 1 scope
- 15 users, ~1.5 months runway
- ₹150/mo paid tier; free tier capped at 3 chat messages
- Target: profitable from user 1 (~₹180-200/mo infra cost)

## Model strategy
- `gpt-4o-mini` — dev vision + summaries
- `gpt-5-mini` — prod vision + chat + recipe generation (CASE 2 fallback)
- `text-embedding-3-small` — embeddings
- **No Claude API.**

## Auth Note
**Phone OTP disabled — Google Login only.**
Clerk phone OTP is unreliable for Indian +91 numbers on the current plan.
Sign-in page: single "Google se login karo" button. No OTP flow.

## Memory / sessions
- Chat session memory lives in **Redis** (3hr TTL).
- **No `chat_sessions` table in Supabase.**

## Retrieval & generation policy
- **Retrieval-first always.** Both recipe and kitchen-knowledge queries go through pgvector + SQL pre-filter.
- **CASE 1 — retrieval hit:** use the curated recipe; refine for family_size, spice_pref, diet, vrat, history. Never silently rewrite ingredients/steps.
- **CASE 2 — retrieval miss:** GPT-5-mini may generate a recipe dynamically. Generated recipes:
  - Saved to the `recipes_pending` table (NOT `recipes`).
  - Shown only to the requesting user — not surfaced in any other user's feed.
  - Must feel homemade, culturally grounded, not restaurant-style.
  - Promotion to canonical `recipes` table requires: `cooked_count >= 3` AND `reported_count = 0`, OR manual admin approval. Never auto-promoted on first cook.
- Separate retrieval domains: `lib/rag.ts` (recipes) and `lib/knowledge.ts` (kitchen fixes/tips). Never merge into one ranked set.

## Tone
- Respectful "aap" — never "tu". Warm mummy/didi/aunty energy, not robotic assistant or restaurant chef.
- Subtle health awareness (kam tel, balanced plate hints). Never dismiss health concerns. Never use lines like "Arre calorie chhod, garam kha le."
- North Indian household vocabulary (katori, chammach, tadka, bhuno, sukha/tariwala).

## Build Status
SESSION 1 ✅ — Scaffold, types, schema.sql, seed data (50 recipes + 116 docs)
SESSION 2 ✅ — lib/ folder: supabase, openai, redis, rag, knowledge, portion
SESSION 3 ✅ — Auth: Clerk Google-only login, proxy.ts middleware, onboarding (3 questions), user DB sync
SESSION 4 ✅ — Home feed: RecipeCard, VibeBadges, VratToggle, search API, surprise API, vrat-toggle API
SESSION 5 ✅ — Recipe detail page: RecipeDetailClient, PortionSlider, TTSButton, WhatsAppShare (paid gate), FloatingChatButton stub, /api/recipes/[id]/cooked
SESSION 6 ✅ — Fridge scanner: /api/fridge/validate, /api/fridge/scan, IngredientChips, /fridge page (3-state). PortionSlider fixed: free 2–6, paid 2–15 with upgrade nudge.
SESSION 7 ✅ — Floating chatbot: ChatWindow, FloatingChatButton wired, /api/chat/message (RAG+Redis+GPT), /api/chat/session (GET/DELETE). RPCs match_recipes + match_knowledge_docs fixed to match lib signatures.
SESSION 8 ✅ — Bug fix (gpt-5-mini→gpt-4o), Razorpay subscriptions (create/status/webhook), UpgradeModal, profile page, /api/users/preferences, PWA manifest + next-pwa, DEPLOY_CHECKLIST.md.

## What's Built — Every File in src/

### src/lib/
- `supabase.ts` — createServerClient() (service role, server-only), createBrowserClient() (anon)
- `openai.ts` — VISION_MODEL, CHAT_MODEL, SUMMARY_MODEL, EMBEDDING_MODEL constants; getEmbedding, validateImage, extractIngredients, chatCompletion
- `redis.ts` — checkRateLimit, getRateLimitRemaining; chat session with 3hr TTL; compressAndUpdateSession
- `portion.ts` — scaleIngredients (pure math, non-linear scaling), shouldShowScalingWarning
- `rag.ts` — searchRecipes (full RAG pipeline: embed → RPC → re-rank → top 3)
- `knowledge.ts` — searchKnowledge (embed → RPC → top 3), hasSafetyFlag

### src/types/
- `index.ts` — all types: Recipe, User, Ingredient, RecipeStep, KnowledgeDoc, RecipePending, etc.

### src/app/
- `layout.tsx` — root layout: Poppins + Noto Sans Devanagari, ClerkProvider, theme-color meta
- `globals.css` — Tailwind v4 @theme inline with project color tokens
- `page.tsx` — server redirect → /sign-in
- `proxy.ts` — Next.js 16 middleware (clerkMiddleware), public routes: /sign-in, /sso-callback, /api/webhooks/razorpay
- `sso-callback/page.tsx` — AuthenticateWithRedirectCallback

### src/app/(auth)/
- `sign-in/[[...sign-in]]/page.tsx` — Google-only sign-in, calls signIn.sso()

### src/app/(main)/
- `layout.tsx` — bottom nav (Ghar/Dhundho/Fridge/Profile), min 48px tap targets
- `home/page.tsx` — SERVER component: auth → fetch user + 20 curated recipes → HomeClient
- `home/HomeClient.tsx` — CLIENT: vrat toggle (instant client-side filter), recipe list, upgrade card, surprise button
- `recipe/[id]/page.tsx` — SERVER: fetch recipe + user → RecipeDetailClient
- `recipe/[id]/RecipeDetailClient.tsx` — CLIENT: portion state, scaled ingredients, TTS text, cooked button, upgrade nudge
- `search/page.tsx` — placeholder
- `fridge/page.tsx` — CLIENT: 3 states (capture → review → results); browser-image-compression; validate then scan flow
- `profile/page.tsx` — SERVER: auth + Supabase fetch → ProfileClient
- `profile/ProfileClient.tsx` — CLIENT: subscription card (free/paid), desi/metric toggle, diet/family display, Clerk SignOutButton

### src/app/onboarding/
- `page.tsx` — 3-step Hinglish flow (diet → restrictions → family size)

### src/app/api/users/
- `sync/route.ts` — POST: create user in Supabase on first login (called after OAuth)
- `onboarding/route.ts` — POST: save diet/restrictions/family_size, set onboarding_done=true
- `vrat-toggle/route.ts` — POST: toggle is_vrat_mode, return new value

### src/app/api/recipes/
- `search/route.ts` — POST: full RAG search (rate-limited, returns top 3 + isEmptyStateFallback)
- `surprise/route.ts` — GET: random curated recipe not cooked in 7 days
- `[id]/cooked/route.ts` — POST: insert cooking_history, call increment_cooked_count RPC

### src/app/api/fridge/
- `validate/route.ts` — POST: peek rate limit (no increment) + validateImage; Hinglish error messages
- `scan/route.ts` — POST: checkRateLimit (increments) + extractIngredients → IngredientChip[]

### src/app/api/chat/
- `session/route.ts` — GET: load Redis session; DELETE: clear session
- `message/route.ts` — POST: rate-limit → user ctx → session load → system prompt fill → parallel RAG → GPT → session save

### src/app/api/subscription/
- `create/route.ts` — POST: auth → check not already paid → create Razorpay subscription → return checkout params
- `status/route.ts` — GET: return subscription_status + ends_at + isPaid

### src/app/api/webhooks/
- `razorpay/route.ts` — POST (public, no auth): HMAC verify → handle 4 events: activated/charged/cancelled/expired → update users + subscriptions tables

### src/app/api/users/
- `preferences/route.ts` — PATCH: update preferred_unit (desi/metric)

### src/components/
- `RecipeCard/RecipeCard.tsx` — horizontal card, emoji thumbnail fallback, VibeBadges, 72px min height
- `VibeBadges/VibeBadges.tsx` — up to 3 vibe pills, #FDE8D8 bg
- `VratToggle/VratToggle.tsx` — pill toggle, green ON / muted OFF, loading spinner
- `PortionSlider/PortionSlider.tsx` — free: 2–6, paid: 2–15; upgrade nudge at free limit; scaling warning
- `TTSButton/TTSButton.tsx` — Web Speech API, hi-IN lang, toggle speak/stop
- `WhatsAppShare/WhatsAppShare.tsx` — paid gate; opens wa.me deeplink for paid users
- `FloatingChatButton/FloatingChatButton.tsx` — owns chatOpen state, renders ChatWindow; accepts recipeId + recipeName
- `ChatWindow/ChatWindow.tsx` — bottom sheet (65vh), message list, typing indicator, rate-limit banner, "Abhi lo →" → UpgradeModal
- `UpgradeModal/UpgradeModal.tsx` — client component: POST /api/subscription/create → dynamic checkout.js inject → Razorpay modal
- `IngredientChips/IngredientChips.tsx` — editable chip list; confirmed (#FDE8D8) vs unconfirmed (#F3F0FF); inline add

### scripts/
- `schema.sql` — full DB schema (users, recipes, recipes_pending, knowledge_docs, cooking_history, subscriptions)
- `seed-recipes.ts` — seeds 50 curated recipes
- `seed-knowledge.ts` (or similar) — seeds 116 knowledge_docs

## What's NOT Built Yet (Session 9 / Phase 2)
- RAZORPAY_PLAN_ID + RAZORPAY_WEBHOOK_SECRET still REPLACE_ME — must fill before payment testing
- PWA icons are 1×1 placeholders — replace with real branded icons before launch
- Dark/light theme toggle (deferred to UI polish phase)
- Search page (/search) — placeholder only
- recipes_pending promotion API (Phase 2 / admin)
- Chat rate limit for paid users (currently always 3/day regardless of subscription_status)

## Known Issues / Decisions
- Clerk phone OTP disabled — Google only
- recipes_pending table exists but no API route yet (Phase 2)
- Supabase RPC functions `match_recipes` + `match_knowledge_docs` — live in production DB
- Recipe thumbnail_url all null — placeholder emoji gradient used in RecipeCard
- `incrementRateLimit` is not a separate export from redis.ts — `checkRateLimit` atomically increments via INCR + EXPIREAT internally; search route uses checkRateLimit only
- Tailwind v4: no tailwind.config.js — config lives in globals.css @theme inline

## Session 9 / Deployment
App is feature-complete for Phase 1. Remaining before launch:
1. Fill RAZORPAY_PLAN_ID (create ₹150/mo plan in Razorpay Dashboard)
2. Fill RAZORPAY_WEBHOOK_SECRET (from Razorpay Dashboard → Webhooks)
3. Replace PWA icons (public/icon-192.png + icon-512.png) with real branded art
4. Deploy to Vercel — see DEPLOY_CHECKLIST.md for full steps
5. Set all env vars in Vercel dashboard
6. Set Razorpay webhook URL to https://[vercel-url]/api/webhooks/razorpay
7. Test payment end-to-end with test card 4111 1111 1111 1111

## Hard constraints
- No Claude API anywhere
- No `chat_sessions` table in Supabase — Redis handles all chat memory
- Vrat mode must filter feed instantly without reload
- AI-generated recipes never auto-promoted to curated library without moderation
- createServerClient() only in API routes and server components — NEVER in client components
- All visible UI text: Hinglish only — no "Submit", "Next", "Continue", etc.
- Minimum tap target: 48×48px on all buttons and nav items

## Source of truth
- PRD: `../chief-ai-arti-PRD-v2.md`
- System design: `../chief-ai-arti-sysdesign-v2.md`
Read these for any spec detail not covered here.

## Next.js note
See `AGENTS.md` and `node_modules/next/dist/docs/` for current Next.js conventions.
Next.js 16: middleware is `proxy.ts` (not `middleware.ts`). Clerk v7 uses signals API (useSignIn returns SignInSignalValue, not { isLoaded, signIn, setActive }). Use signIn.finalize() not setActive().
