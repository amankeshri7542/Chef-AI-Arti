# Chief-AI-Arti — Session Log

## Session 1 — Scaffold + Knowledge Base
**Date:** ~2026-05-20
**Built:**
- Next.js 16 App Router scaffold with TypeScript + Tailwind v4
- `src/types/index.ts` — all domain types (Recipe, User, Ingredient, RecipeStep, KnowledgeDoc, RecipePending, etc.)
- `scripts/schema.sql` — full DB schema: users, recipes, recipes_pending, knowledge_docs, cooking_history, subscriptions
- `data/recipes.json` — 50 curated North Indian recipes (UP/Bihar/Delhi focus)
- `data/knowledge-docs.json` — 116 atomic knowledge chunks (substitutions, fixes, tips, seasonal, festival, technique)
- `scripts/seed-recipes.ts` — seed script (added dotenv loading fix for .env.local)
- `scripts/system-prompt.txt` v2 — Hinglish chatbot persona
- `public/` — favicon, placeholder assets

**Seeded:** 50 recipes + 116 knowledge_docs in Supabase
**Key files:** src/types/index.ts, scripts/schema.sql, scripts/seed-recipes.ts
**tsc:** clean

---

## Session 2 — Infrastructure Layer
**Date:** ~2026-05-22
**Built:** All 6 lib/ files:
- `src/lib/supabase.ts` — createServerClient (service role) + createBrowserClient (anon)
- `src/lib/openai.ts` — getEmbedding, validateImage, extractIngredients, chatCompletion; model constants
- `src/lib/redis.ts` — checkRateLimit (INCR + EXPIREAT, atomic), getRateLimitRemaining; chat session (3hr TTL); compressAndUpdateSession
- `src/lib/portion.ts` — scaleIngredients (non-linear: oil×0.6, salt×0.7, spice×0.65, water capped ×2, fixed=unchanged); parseDesi with Unicode fractions
- `src/lib/rag.ts` — searchRecipes: embed → match_recipes RPC → re-rank (similarity + region + spice + recency penalty) → top 3
- `src/lib/knowledge.ts` — searchKnowledge: embed → match_knowledge_docs RPC → top 3; hasSafetyFlag (tag-based)

**Supabase RPC created:**
- `match_recipes(query_embedding, diet, vrat_mode, restrictions, disliked, match_count)` — SQL pre-filter + pgvector cosine
- `match_knowledge_docs(query_embedding, applies_to_filter, match_count)` — SQL pre-filter + pgvector cosine

**Key decisions:**
- incrementRateLimit is NOT a separate function — checkRateLimit atomically does INCR+EXPIREAT internally
- Separate retrieval domains: rag.ts (recipes) and knowledge.ts (knowledge) — never merged
- Redis rate limits: recipes=10/day, chat=3/day, scan=2/day, ai-gen=1/day

**tsc:** clean

---

## Session 3 — Auth + Onboarding
**Date:** ~2026-05-26
**Built:**
- `src/proxy.ts` — Next.js 16 middleware (clerkMiddleware), public routes: /sign-in, /sso-callback, /api/webhooks/razorpay
- `src/app/layout.tsx` — Poppins + Noto Sans Devanagari fonts, ClerkProvider, lang="hi", theme-color meta
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Custom Hinglish sign-in (started as phone+Google, simplified to Google-only in Session 4)
- `src/app/sso-callback/page.tsx` — AuthenticateWithRedirectCallback
- `src/app/api/users/sync/route.ts` — POST: create user row in Supabase on first login
- `src/app/api/users/onboarding/route.ts` — POST: save diet/restrictions/family_size, set onboarding_done=true
- `src/app/onboarding/page.tsx` — 3-step Hinglish onboarding (diet → restrictions → family size)
- `src/app/(main)/layout.tsx` — bottom nav (Ghar/Dhundho/Fridge/Profile), 48px tap targets
- `src/app/(main)/home/page.tsx` — placeholder (replaced in Session 4)
- Placeholder pages: search, fridge, profile
- `src/app/page.tsx` — server redirect → /sign-in

**Clerk v7 learnings:**
- useSignIn() returns SignInSignalValue (signals API) — no isLoaded/setActive
- Phone OTP: signIn.phoneCode.sendCode() + verifyCode() + finalize()
- Google OAuth: signIn.sso({ strategy: 'oauth_google', redirectUrl, redirectCallbackUrl })
- signIn.finalize() replaces old setActive()

**Flow tested:** Google login → /onboarding → /home redirect ✅

---

## Session 4 — Home Feed + API Routes
**Date:** 2026-05-27
**Built:**

**Clerk Fix:**
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Simplified to Google-only (phone OTP removed)
  - Reason: Clerk phone OTP unreliable for Indian +91 on free plan

**UI Components:**
- `src/components/VratToggle/VratToggle.tsx` — pill toggle (green ON / muted OFF, loading spinner, 48px min height)
- `src/components/VibeBadges/VibeBadges.tsx` — max 3 vibe pills, #FDE8D8/#BF4E06
- `src/components/RecipeCard/RecipeCard.tsx` — horizontal card, next/image thumbnail, emoji gradient fallback, 72px min height, active:scale-[0.98]

**Home Feed:**
- `src/app/(main)/home/page.tsx` — SERVER: auth → user → 20 curated recipes → HomeClient
- `src/app/(main)/home/HomeClient.tsx` — CLIENT: vrat toggle (POST /api/users/vrat-toggle + instant client-side filter), recipe list, upgrade card after card 10 (free tier), surprise button, Hindi weekday header

**API Routes:**
- `src/app/api/recipes/search/route.ts` — POST: rate-limited RAG search (searchRecipes from lib/rag.ts)
- `src/app/api/recipes/surprise/route.ts` — GET: random recipe not cooked in 7 days (JS random over LIMIT 10 pool)
- `src/app/api/users/vrat-toggle/route.ts` — POST: toggle is_vrat_mode, return new value

**Test results:**
- ✅ Sign-in page: Google button only, correct tagline
- ✅ Unauthenticated /home → redirects to /sign-in (Clerk proxy working)
- ✅ All 3 new API routes live, 307-redirecting unauthenticated requests to /sign-in
- ✅ tsc --noEmit: zero errors
- ⚠️ b-f (feed, vrat toggle, upgrade card): requires real Google login — not testable in headless browser

**Known issues entering Session 5:**
- Clerk phone OTP disabled — Google only
- Recipe thumbnail_url all null — emoji gradient placeholders showing
- recipes_pending table exists, no API route yet

**tsc:** clean (zero errors, excluding stale .next/dev/types/validator.ts which clears on next build)
