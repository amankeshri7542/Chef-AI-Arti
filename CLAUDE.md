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
SESSION 9 ✅ — Paid user chat bypass, real PWA icons (canvas, 5.3KB/15.5KB), proxy.ts public routes fixed (manifest+icons), GitHub push. Vercel deploy pending manual `vercel login`.

## SESSION 12 ✅ — Public browse, real search, skeletons, fridge error logging, onboarding region, OpenAI bundle fix
- proxy.ts: /home, /recipe/*, /search, /api/recipes/* now public — no login to browse
- home/page.tsx: null-safe user, no redirect for unauthenticated guests
- recipe/[id]/page.tsx: public access; null user handled with defaults
- RecipeDetailClient: new props {recipe, user, isAuthenticated}; unauth actions → LoginPromptModal
- LoginPromptModal: bottom-sheet for unauth feature prompts (Bana liya!, chat, WhatsApp)
- search/page.tsx: real search with debounce, category chips, RecipeCard results, empty state
- api/recipes/search/route.ts: public guest access with veg/medium defaults, no rate-limit for guests
- RATE_LIMITS extracted to rate-limits.ts (client-safe) — fixes OpenAI library bundled to browser via ChatWindow→redis.ts→openai.ts chain
- match_recipes RPC: recompiled with explicit ::text casts (varchar→text) to fix "structure mismatch" error
- Skeletons: RecipeCardSkeleton, PageSkeleton, loading.tsx for home/search/recipe/[id]
- openai.ts validateImage/extractIngredients: console.error logging instead of silent catch
- fridge/validate/route.ts: logs image size (chars) for debugging
- Onboarding Q3: Region selection (UP-Bihar/Delhi-NCR/Punjab-Haryana/Rajasthan-MP/other) replaces restrictions
- api/users/onboarding/route.ts: preferred_region replaces restrictions field
- Git commits: e2ed819, 419e24a, 2047d78, b2bbd1f, ed5e6a7 + DB migration recompile_match_recipes

## What's Built — Every File in src/

### src/lib/
- `supabase.ts` — createServerClient() (service role, server-only), createBrowserClient() (anon)
- `openai.ts` — VISION_MODEL, CHAT_MODEL, SUMMARY_MODEL, EMBEDDING_MODEL constants; getEmbedding, validateImage, extractIngredients, chatCompletion
- `redis.ts` — checkRateLimit, getRateLimitRemaining; chat session with 3hr TTL; compressAndUpdateSession. Re-exports RATE_LIMITS from rate-limits.ts.
- `rate-limits.ts` — RATE_LIMITS constant only (no server deps — safe to import in client components)
- `portion.ts` — scaleIngredients (pure math, non-linear scaling), shouldShowScalingWarning
- `rag.ts` — searchRecipes (full RAG pipeline: embed → RPC → re-rank → top 3)
- `knowledge.ts` — searchKnowledge (embed → RPC → top 3), hasSafetyFlag

### src/types/
- `index.ts` — all types: Recipe, User, Ingredient, RecipeStep, KnowledgeDoc, RecipePending, etc.

### src/app/
- `layout.tsx` — root layout: Poppins + Noto Sans Devanagari, ClerkProvider, theme-color meta
- `globals.css` — Tailwind v4 @theme inline with project color tokens
- `page.tsx` — server redirect → /sign-in
- `proxy.ts` — Next.js 16 middleware (clerkMiddleware). Public: /, /home, /recipe/*, /search, /sign-in, /api/recipes/*, /api/webhooks/*. Protected pages redirect to /sign-in; protected APIs return 401 JSON.
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

## What's NOT Built Yet (Phase 2 / pending)
- S3 bucket needs public read ACL for thumbnail URLs to be visible (Aman must set bucket policy — see note below)
- Chat rate limit display in ChatWindow reads from API response `remaining` field but initial count shown is from RATE_LIMITS constant (correct — seeds on load)

## What's NOT Built Yet (Phase 2)
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
- CDN caches 404 for unauthenticated programmatic requests to protected routes (Clerk design: isPageRequest() returns false for curl/CDN prefetch → notFound()). Real browser users get correct redirect to /sign-in. Not a bug, just CDN behavior.

## SESSION 11 ✅ — Tiered rate limits, ingredient map, thumbnail upload, PWA install
- redis.ts: RATE_LIMITS tiered (free: chat 3/scan 2/recipes 10, paid: chat 20/scan 10/recipes 100). checkRateLimit + getRateLimitRemaining accept subscriptionStatus param (default 'free' for backward compat).
- All API routes (chat/message, fridge/scan, fridge/validate, recipes/search) now fetch subscription_status and pass to rate limit. 429 messages are dynamic per tier.
- ChatWindow + FloatingChatButton: subscriptionStatus threaded from RecipeDetailClient through to ChatWindow. Banner shows correct limit for free vs paid.
- ingredient-map.ts: 60+ English→Hinglish translation map. buildHinglishQuery produces bilingual terms ("potato aloo"). Fridge page uses it before RAG search.
- /api/recipes/[id]/thumbnail POST: S3 upload + Supabase thumbnail_url update. Accepts multipart/form-data.
- RecipeDetailClient: photo upload prompt after "Bana liya!", browser-image-compression, success/error states, useRef for file input.
- PWAInstallButton component: beforeinstallprompt listener, returns null if not installable. Added to ProfileClient.
- next.config.ts: remotePatterns for *.s3.*.amazonaws.com thumbnails.
- Git commit: 4641401. Deployed to Vercel. All routes 401 on direct URL (auth working).

## SESSION 10 ✅ — Production diagnosis + bug fixes + custom domain
- Diagnosed production 404s: NOT a code bug. Root cause: CDN stale cache from old deployment + Clerk's notFound() for non-browser unauthenticated requests. App confirmed WORKING for real authenticated users (200 on /home, /profile, /fridge, all APIs).
- Fixed RAZORPAY_WEBHOOK_SECRET: generated secret, added to Vercel, redeployed. Webhook endpoint verified (returns 401 on bad sig, not 500).
- Added custom domain arti.amankeshri.com to Vercel project. DNS auto-resolved via existing wildcard ALIAS on Vercel nameservers.
- Set NEXT_PUBLIC_APP_URL=https://arti.amankeshri.com in Vercel env.
- 3 fresh production deploys done. Both chief-ai-arti.vercel.app and arti.amankeshri.com are live.

## Manual Steps Still Needed (Aman must do in dashboards)
1. RAZORPAY WEBHOOK — see below for exact secret value and instructions
2. CLERK — add arti.amankeshri.com as allowed origin in Clerk dashboard
3. PWA icons — replace public/icon-192.png + icon-512.png with real branded art
4. Test payment end-to-end with Razorpay test card 4111 1111 1111 1111

## RAZORPAY_WEBHOOK_SECRET (set in Vercel)
Secret value: 204e557a212b02abd323e5deb2d376a37373d73bd377277cb081ff671548decf
Webhook URL: https://arti.amankeshri.com/api/webhooks/razorpay
Events: subscription.activated, subscription.charged, subscription.cancelled, subscription.expired

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
