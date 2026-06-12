# Chief-AI-Arti

**Tagline:** "Aaj kya banao?"
Hinglish-first AI recipe PWA for North Indian homemakers.

---

# 📍 CURRENT STATE — READ THIS FIRST (As-Built)

> Authoritative technical snapshot. On any conflict, **this section overrides** the
> chronological `## Build Status` session log and the older "What's NOT Built" lists
> further down (many of those are stale — the features were since built). Last
> updated: **session-35b, commit `65e9a1c`**, deployed prod, branch `main`.

## What it is
A mobile-first **PWA** (installable, offline-aware) that helps North Indian homemakers
decide and cook everyday meals. Warm "mummy/didi" Hinglish persona ("aap", never "tu").
Retrieval-first recipe engine over a curated library, with AI generation only on a miss.
**Phase 1**: ~15 users, ₹150/mo paid tier, free tier capped (3 chat msgs/day). Profitable from user 1.

## Live metrics (verify with SQL before trusting — these drift)
- **198** curated recipes (0 missing nutrition, 0 missing thumbnails), **146** knowledge docs.
- **5** users (2 paid), 10 cooks logged, a handful of ratings. Tiny dataset — design for that.
- Prod: `https://arti.amankeshri.com` (also `chief-ai-arti.vercel.app`).

## Stack (versions matter)
- **Next.js 16.2.6** App Router + TypeScript + Tailwind v4 (config in `globals.css @theme`, no tailwind.config.js).
- **Clerk v7** — Google login ONLY (phone OTP disabled; unreliable for +91). Middleware is `src/app/proxy.ts` (Next 16 renamed `middleware.ts`→`proxy.ts`).
- **Supabase** Postgres + pgvector. ALL app DB access via `createServerClient()` (service role, server-only). `createBrowserClient()` exists but is UNUSED.
- **Upstash Redis** — rate limits + chat session memory (3hr TTL) + webhook idempotency + admin lockout. NO `chat_sessions` table.
- **OpenAI** — see Model strategy below. **No Claude API anywhere** (hard rule).
- **Razorpay** subscriptions, **AWS S3** (ap-south-1, `chief-arti-fridge-scans`) + **CloudFront** CDN (WebP thumbnails).
- Monitoring: Sentry + PostHog (Sentry SDK config is outdated — see Open Tasks).

## Model strategy (`src/lib/openai.ts`, all `|| env` overridable)
- `CHAT_MODEL` = **gpt-5-mini** (chat + the GPT recipe-generation fallback). `OPENAI_TRANSCRIPT_MODEL` = gpt-5-mini.
- `VISION_MODEL` / `SUMMARY_MODEL` = **gpt-4o-mini** (fridge scan vision — do NOT change to gpt-5).
- `EMBEDDING_MODEL` = text-embedding-3-small.

## Architecture & core flows
- **Retrieval-first** (`lib/rag.ts` recipes, `lib/knowledge.ts` tips — kept as SEPARATE ranked sets, never merged):
  embed query → `match_recipes`/`match_knowledge_docs` RPC (pgvector, ivfflat probes=10) → `SIMILARITY_FLOOR=0.30` → soft re-rank (region/spice/time/skill/kitchen boosts, recency penalty) → top 3.
- **CASE 1** (retrieval hit): refine the curated recipe for the user (family_size, spice, diet, vrat). Never silently rewrite ingredients/steps.
- **CASE 2** (miss → `triggerCase2`): generate via **YouTube pipeline** (`lib/youtube.ts` → transcript → gpt-5-mini extraction) with a plain-GPT fallback. Result saved to `recipes_pending` (NOT `recipes`), shown only to the requester (`shown_to_user_ids`). **Promotion** to canonical `recipes` needs `cooked_count>=3 AND reported_count=0`, OR admin approval — never auto-promoted on first cook. On promote, `promoted_recipe_id` is set and the pending page redirects there.
- **Search** (`api/recipes/search`): direct SQL name/tag match FIRST, vector only to fill. Honors `isEmptyStateFallback`/`triggerCase2` → shows the generate CTA, not popular recipes.
- **Fridge** (`api/fridge/validate` → `scan`): vision → ingredient chips → recipes (CASE 2 if miss).
- **Chat** (`api/chat/message`): rate-limit → RAG context → Redis session → gpt-5-mini → save session.
- **41 API routes**; all are auth'd (Clerk), self-guarded (CRON_SECRET / webhook HMAC), or admin-cookie-gated.

## Key data model (see `scripts/schema.sql` — source of truth)
- `recipes` (curated; `source` in 'curated'|'ai', `nutrition` JSONB, `avg_rating`/`rating_count`, `embedding`, `youtube_*`, `thumbnail_url`).
- `recipes_pending` (CASE 2 staging; `shown_to_user_ids` UUID[], `status` pending|promoted|rejected, `promoted_recipe_id`, `youtube_*`). **IDs here are `users.id` UUIDs, NOT clerk ids.**
- `users` (clerk_user_id, diet_type, family_size, spice_preference, cooking_for/skill, time_preference, kitchen_setup[], subscription_status, preferred_region/unit).
- `cooking_history`, `recipe_ratings`, `recipe_saves` (**user_id = clerk id here**), `recipe_photos`, `knowledge_docs`, `subscriptions`, `push_subscriptions`, `push_logs`.

## Security posture (hardened sessions 34–35 — DON'T regress)
- **RLS ON** for users, cooking_history, subscriptions, recipe_ratings, recipe_saves, recipe_photos, push_subscriptions, **recipes, recipes_pending**. The latter two were a P0 (anon had write/TRUNCATE grants) — RLS enabled + grants revoked. Service role bypasses RLS; no public policies. `knowledge_docs`/`push_logs` RLS off (read-only/service-only, accepted).
- **Rate limits** (`lib/rate-limits.ts`, Redis) on every OpenAI-spending route: chat, scan, validate, recipes(search), ai-gen, guest-search (per-IP). Free vs paid tiers.
- **Razorpay webhook**: HMAC verify + Redis idempotency on `x-razorpay-event-id` (no replay re-extension).
- **Admin**: cookie auth (`lib/admin-auth.ts`, timing-safe), 5/15min/IP Redis login lockout. `subscription_status` writable ONLY by admin route + webhook.

## Conventions / practices (follow these)
- **All visible UI text Hinglish** — no "Submit/Next/Continue". Min tap target 48×48px.
- `createServerClient()` only in API routes / server components, NEVER client.
- Build with **`next build --webpack`** (Turbopack breaks next-pwa's SW generation). `npm run dev` fails on Next 16 → use `npx next dev --webpack`.
- Ship loop: `tsc --noEmit` → `next build --webpack` → commit `session-NN: …` (Co-Authored-By Claude) → `vercel --prod` → `git push`. Update this file's Build Status after.
- Aman runs DB migrations himself OR they're applied via the Supabase MCP (`apply_migration`). Keep `scripts/schema.sql` in lockstep with live DB.
- Vrat mode filters the feed instantly client-side (no reload). AI recipes never auto-promoted without the gate/moderation.
- **NOT phone-tested** is the recurring gap — desktop-browser verification only across most sessions. Flag UI changes as needing real-device testing.

## Open tasks / what's next (priority order)
1. **Real Android device test** — the #1 risk for a mobile-only app for non-technical users (golden path + cooking mode + payment).
2. **Vercel BotID/Firewall** on `/api/recipes/search` + `/generate` — IP rotation evades the app-layer guest cap (the real DDoS backstop).
3. **Sentry SDK config** is outdated (build warns: missing `onRequestError` hook, move `sentry.client.config.ts`→`instrumentation-client.ts`) — errors may be under-reported.
4. **Generation quality** — CASE 2 drifts ("Manchurian"→"Manchurian Fried Rice bacha hua"); pin the generated dish to the canonical name in the prompt.
5. **Personalization** — refine-in-place chips (kam tel / aur teekha / jain), learn ranking from actual cooks+ratings (not just onboarding), "why this recipe" reason line.
6. **Saved/rating badges on home featured cards** (search grid + profile done; home uses an inline FeaturedCard not yet wired).
7. **CLAUDE.md hygiene** — the chronological log below is history; trust THIS section. Consider pruning stale "What's NOT Built" lists.

## Source-of-truth docs
- This file (auto-loaded) · `AGENTS.md` (Next 16 conventions) · `../chief-ai-arti-PRD-v2.md` + `../chief-ai-arti-sysdesign-v2.md` (both have v3 "As-Built" sections) · `scripts/schema.sql` (DB).

---

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
SESSION 35 ✅ — search relevance, saved/rating on cards, generated-recipe surface, family-size editor (4 user-reported bugs)
  - SEARCH RELEVANCE ("Manchurian → Bengali Khichuri"): rag.ts SIMILARITY_FLOOR 0.25→0.30 (cross-cuisine accidents ≈0.26 were shown as confident hits; real dish/ingredient queries get a direct name/tag match in the search route and never reach the floor). ROOT-CAUSE PAIR FIX: emptyStateFallback returns the top-5 POPULAR recipes with triggerCase2/isEmptyStateFallback=true, but search/page.tsx's fetchSearch IGNORED those flags → showed popular recipes as if they matched. fetchSearch now returns {recipes, miss} and treats a fallback as miss → results=[] → the existing "Arti banaye?" generate CTA fires instead of irrelevant recipes.
  - "SAB RECIPES — 24 RECIPES" mislabel: default browse loads limit:24 of 198; heading was "📋 Sab Recipes — 24 recipes" (implied only 24 exist). Now "🔥 Popular Recipes" with NO count on the default view; count ("N recipes mili") shown only for real searches/chips/collections.
  - SAVED/RATING ON CARDS: RecipeCardCompact gained a `saved` prop → ❤️ badge top-left (won't collide with the vrat dot top-right). Rating star threshold lowered rating_count>=3 → >=1 (&& avg>0) so a user's own first rating shows. search/page.tsx fetches GET /api/recipes/saved on mount (signed-in) → Set of saved ids → passes saved to each card. (Home featured cards are inline FeaturedCards, NOT RecipeCardCompact — not yet wired; extend there if needed.)
  - GENERATED-RECIPE SURFACE (fixes "YT recipe won't open 2nd time" — ROOT CAUSE: recipes_pending rows had NO entry point except the one post-generate router.push; not in search/home/saveable, so they vanished on navigate-away. The row itself was always valid server-side.): profile/page.tsx now queries recipes_pending where shown_to_user_ids contains user.id AND status='pending' (limit 10, recent first) → passes generatedRecipes [{id,name,youtubeVideoId}] → ProfileClient renders "✨ Arti ne aapke liye banayi" list (YT thumb via img.youtube.com/vi/{id}/default.jpg or 🍲) linking to /recipe/pending/[id]. (Promoted pending recipes already redirect to /recipe/[promoted_recipe_id] via the session-34 fix.)
  - FAMILY-SIZE EDITOR (fixes "selected 8, now default / can't change"): family_size was DERIVED from cooking_for and preferences/route.ts OVERWROTE it on any cooking_for update (bucket: alone1/couple2/family4/pg1). Route now accepts family_size directly (validate int 1-15) AND only derives from cooking_for when family_size is NOT explicitly sent (no more clobbering). ProfileClient "Parivar" row was static display → now a −/+ stepper (1-15) that PATCHes family_size optimistically (reverts on failure). NOTE: the reporting user's DB family_size=8 was already correct (paid, portion slider inits to 8); the real gap was no way to change it.
  - VERIFY: tsc clean, next build --webpack clean (PWA sw.js regenerated). Commits: fd62d19 (relevance+cards, deployed dpl_HEcjBF2…), + this batch. NOT phone-tested.

SESSION 34 ✅ — promoted-recipe redirect fix, security audit (RLS P0 closed), webhook idempotency, admin brute-force lockout, chat model → gpt-5-mini
  - NUMBERING: the resume prompt called this "session-31", but git was already at session-33, so committed as session-34 to keep chronological order. Items 1 (redirect) + 4 (chat model) were sitting UNCOMMITTED in the working tree from an interrupted session — verified correct and shipped here.
  - REDIRECT FIX (item 1, was already coded uncommitted): recipes_pending.promoted_recipe_id column EXISTS live (uuid). Both promotion paths (api/recipes/pending/[id]/cook + api/admin/pending/[id]/approve) now set promoted_recipe_id=promoted.id. /recipe/pending/[pendingId]/page.tsx redirects to /recipe/{promoted_recipe_id} when status='promoted', and shows a warm "hata diya" card when status='rejected' (no more dead-end cook flow on stale pending links). schema.sql + RecipePending type carry the column.
  - CHAT MODEL (item 4, was already coded uncommitted): openai.ts CHAT_MODEL now `process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini'` (was gpt-4o). generate-recipe.ts generateRecipe fallback uses CHAT_MODEL → also gpt-5-mini. TRANSCRIPT_MODEL gpt-5-mini. VISION_MODEL + SUMMARY_MODEL left at gpt-4o-mini (vision must NOT change). All model consts switched `??`→`||` so an empty-string env still falls back to a real model name.
  - SECURITY AUDIT (item 2):
    * RLS P0 CLOSED: recipes + recipes_pending had RLS OFF *and* the public anon role held INSERT/UPDATE/DELETE/TRUNCATE — anyone with NEXT_PUBLIC_SUPABASE_ANON_KEY (ships in every browser) could TRUNCATE the recipe library via the REST endpoint. Migration `enable_rls_recipes_and_pending` applied LIVE: ALTER TABLE … ENABLE ROW LEVEL SECURITY (no policies) + REVOKE write grants from anon/authenticated. Service role (createServerClient — all app DB access) bypasses RLS, and createBrowserClient is defined-but-UNUSED, so zero app breakage. All other sensitive tables (users, cooking_history, subscriptions, recipe_ratings, recipe_saves, recipe_photos, push_subscriptions) already had RLS ON. schema.sql now documents the RLS posture.
    * WEBHOOK IDEMPOTENCY: api/webhooks/razorpay replayed a valid payload would re-extend subscription_ends_at (+30d each replay). NEW claimWebhookEvent() in redis.ts (SET NX, 7d TTL) dedups on x-razorpay-event-id (falls back to signature) → duplicate events return {received,duplicate:true} without processing. (Duplicate subscriptions rows were already blocked by the UNIQUE(razorpay_sub_id) constraint.)
    * ADMIN LOCKOUT: api/admin/login had unlimited password guesses. NEW checkAdminLoginAllowed()/resetAdminLoginAttempts() in redis.ts — 5 attempts per IP per rolling 15min → 429; reset on success. Token compare already timing-safe (admin-auth.ts).
    * SECRETS: clean — SERVICE_ROLE / RAZORPAY_KEY_SECRET only in server files (supabase.ts, subscription/create), no 'use client' leak.
    * INPUT SAFETY: search route strips PostgREST .or() metachars (%,_,(),,) before building the ilike expr; all queries go through parameterized Supabase client (no raw SQL concat); React escapes output. SQLi/XSS probes safe.
  - ABUSE TESTS (item 3, all verified PASS in code — no fix needed): rate-without-cooking_history → 403 (rate route); free user → bacha-hua/suggest → 403; /recipes/generate ai-gen cap → 429 on 6th distinct generation (dish-name dedup returns cached BEFORE the cap, but that's a free cache hit, not a bypass); subscription_status only written by admin route (cookie-gated) + webhook (signature-verified) — no client-writable path.
  - VERIFY: tsc clean, `next build --webpack` clean (PWA sw.js regenerated, NetworkOnly present). Sentry onRequestError/global-error warnings are pre-existing, unrelated.

SESSION 33 ✅ — 46 recipes via YouTube seed pipeline (DB 152→198), rate-limit audit + 3 fixes, gpt-5-mini transcript model, PRD/sysdesign v3
  - NOTE: there was NO session 31/32 in git — the "session 32 model switch" never happened; done here instead. TRANSCRIPT_MODEL in generate-recipe.ts now `process.env.OPENAI_TRANSCRIPT_MODEL ?? 'gpt-5-mini'` (verified working on the key; gpt-5-mini is in the OpenAI project's allowed-models list). CHAT_MODEL env still gpt-4o — unchanged.
  - SEED PIPELINE: NEW scripts/seed-batch3-youtube.ts — 50-target gap-fill list (15 non-veg, 8 jain, 7 vegan, 5 each south-indian/bengali/gujarati/maharashtrian) hardcoded with pinned diet_type/region/tags per dish. Per dish: dedup (ilike terms + tags overlap — seeded rows get dedupTags merged into tags so re-runs skip them) → searchYouTubeRecipeCandidates → walk top-5 candidates' transcripts (top video often has transcripts DISABLED — candidate-walking recovered all 5 such failures) → gpt-5-mini full extraction (richer prompt: name_hindi/spice/style/heaviness/meal_type/goes_well_with, vibes whitelisted vs VibeBadgeKey) → jain/vegan ingredient ban-list enforcement (vegan ghee→Tel substitution; PLANT_MARKERS whitelist so "soya dahi" isn't flagged; banned LINEAR ingredient fails the recipe) → embedding (imports admin _lib/embedding.ts builder — scripts/seed-recipes.ts can't be imported, it runs main() at module top) → generateThumbnail → INSERT recipes source='curated' with youtube_* fields. Flags: --dry-run, --limit N.
  - RESULTS: 46 created / 4 dedup-skipped (Anda Bhurji, Kathal, Thepla, Poha) / 0 failed after candidate-walk retry. Cost ~₹162. DB now 198 curated: non-veg 15, eggetarian 3, jain-tagged 8, vegan-tagged 7 (incl. existing Kathal re-tagged + re-embedded), regions south-indian 5/bengali 5/gujarati 5/maharashtrian 4 (Poha skipped). JAIN/VEGAN ARE TAGS on diet_type='veg' rows, NOT diet_types — match_recipes hierarchy maps jain/vegan users → veg. RegionOrigin type widened with the 4 onboarding slugs ('south-indian','bengali','gujarati','maharashtrian') so the rag.ts region boost (exact equality) now fires for those users.
  - youtube.ts: searchYouTubeRecipe refactored to wrap NEW exported searchYouTubeRecipeCandidates (all >10k-view candidates sorted by views) — app behavior unchanged.
  - NUTRITION: estimate-nutrition.ts run → 47 filled (46 new + Aloo Palak Ki Sabzi, a promoted pending row that also lacked a thumbnail — generated via generate-thumbnails.ts). 0 nulls, 0 missing thumbnails in DB.
  - RATE-LIMIT AUDIT (every OpenAI-spending route): chat/scan/generate/logged-in-search were already metered; admin cookie-gated; cron CRON_SECRET; pending-cook thumbnail bounded by cook-guard. THREE GAPS FIXED: (1) GUEST SEARCH was unlimited on a public route (embedding per query) → new 'guest-search' bucket 30/day per IP (x-forwarded-for), applied only to query path — filter-only SQL browse uncapped; (2) fridge/validate only PEEKED the scan counter → new 'validate' bucket (free 6/paid 30) that actually increments; (3) bacha-hua/suggest CASE 2 had NO limit (paid users bypassed ai-gen cap) → now consumes the same 'ai-gen' bucket as /generate. RateLimitAction type + RATE_LIMITS extended. Residual: IP rotation can evade the guest cap — platform layer (Vercel Firewall/BotID) is the real DDoS backstop.
  - DOCS: ../chief-ai-arti-PRD-v2.md and ../chief-ai-arti-sysdesign-v2.md bumped to v3 — new "Current State / As-Built" section at top of each (overrides the preserved Phase-1 spec below it; includes actual rate-limit table + model strategy).

SESSION 30 ✅ — search ROOT CAUSES (RPC diet equality + ivfflat probes), dedup fix, thumbnail auto-gen, 101 nutrition fills, ui-polish
  - SEARCH "kadai→Chicken Biryani" TWO ROOT CAUSES, both in match_recipes RPC (migration fix_match_recipes_diet_and_probes): (1) `r.diet_type = diet` STRICT equality — non-veg users could ONLY ever see the 1 non-veg recipe (Chicken Biryani) no matter the query. Now hierarchical: veg→veg, eggetarian→veg+egg, non-veg→all 3, vegan/jain/other→veg. (2) ivfflat index lists=10 with default probes=1 scanned ~1/10th of recipes (explained "kadai" returning 1 row with LIMIT 5); RPC now does set_config('ivfflat.probes','10',true) → exact search at this scale. Verified live: kadai→kadhi/kadai dishes, xyzqwerty→fallback. PLUS rag.ts SIMILARITY_FLOOR=0.25 (noise ≈0.13, weak-real ≥0.26): all-below-floor → emptyStateFallback (triggerCase2 true → search page generate CTA). match_knowledge_docs NOT touched — it orders by preference_order BEFORE similarity (so similarity is only a tiebreaker — questionable, revisit) and that ORDER BY already prevents ANN index use, so probes don't matter there.
  - "SAME RECIPE FOR EVERYTHING" generate bug: step 4b blanket per-user 24h dedup REMOVED (returned user's latest pending for ANY query). Step 4a dish-name dedup tightened from ilike %name% to exact case-insensitive ilike. Rate limit ai-gen (free 1/day, paid 5/day) now actually enforces — it was short-circuited by dedup before.
  - THUMBNAIL AUTO-GEN: NEW src/lib/thumbnail.ts — generateThumbnail(id,name) (gpt-image-1→dalle3 fallback→sharp 800px webp q82→S3→CF url, returns null on failure; no dotenv — env via process.env, importable from routes AND scripts) + youtubeThumbnailUrl(videoId). scripts/generate-thumbnails.ts now a thin wrapper (sets thumbnail_source='ai'). recipes_pending has NO thumbnail columns — YT thumb is DERIVED from youtube_video_id (img.youtube.com/vi/{id}/hqdefault.jpg, zero migration): pending page passes youtubeVideoId → PendingRecipeClient renders it + "📺 Source: YouTube" 9px label. BOTH promotion paths (cook route + admin approve) insert thumbnail_url=YT-frame/thumbnail_source='youtube-temp' (or none), then AWAIT generateThumbnail best-effort → update to 'ai' (admin approve takes ~1min because of this — acceptable; Vercel timeout 300s). Admin approve also NOW carries youtube_* through (was dropped before). ThumbnailSource type += 'youtube-temp'; RecipeDetailClient hero shows the 📺 label when thumbnail_source='youtube-temp'; img.youtube.com added to next.config remotePatterns.
  - NUTRITION: 101 recipes (not 14! whole session-25 batch was never estimated) filled via ORIGINAL estimate-nutrition.ts, 0 failures, 0 nulls remain. Egg Curry 180kcal/8.5g, Kala Chana 250/10.5, Soya Chunk 210/15.
  - UI POLISH: BottomNav 4px saffron dot under active tab; onboarding + profile pref-sheet errors warmed (#FFF0E6/#F5A55B/#BF4E06 + ⚠️); HomePageSkeleton featured card 180→190px. Search chip active state + home skeleton already existed (no-op). Samagri heading kept Playfair (next/font bundles woff2 — consistent on Android; not device-tested).
  - Commit c465d69, pushed, deployed prod (chief-ai-arti-qzhkshoib). tsc + build clean.

SESSION 29 ✅ — nutrition display fix (root cause), generate-button UX, WebP thumbnails (95% smaller), footer, saved-recipes UI
  - NUTRITION "6.3g protein for Chicken Biryani" ROOT CAUSE: NOT bad DB data — DB per_serving was already correct (25g/450kcal). NutritionDisplay.tsx computed ratio = currentServings/baseServings and multiplied PER-SERVING macros by it → divided by base a second time. Fixed: ratio = currentServings (per_serving × people).
  - scripts/fix-protein-nutrition.ts EXISTS but its GPT re-estimates were REJECTED (dry-run showed dal regressions: Moong Dal 9g→2.3g — per-100g reference-values prompt made GPT lose serving size). Aman chose "UI fix only". 14 recipes still have nutrition=null (Egg Curry, Kala Chana Masala, Soya Chunk Curry, several dals/shorbas) — if filling later, use the ORIGINAL estimate-nutrition.ts (no --force), not the protein-fix script.
  - WEBP THUMBNAILS: scripts/convert-thumbnails-webp.ts (--dry-run/--delete-old) ran LIVE: 150/150 converted, 230.3MB→10.9MB (95% smaller), thumbnail_url now https://{CLOUDFRONT_DOMAIN}/thumbnails/{id}.webp — verified 200 image/webp via CF. OLD PNGs STILL IN S3 (kept deliberately; delete later with --delete-old after soak). generate-thumbnails.ts now pipes through sharp → 800px webp q82 + uses CLOUDFRONT_DOMAIN url when set. next.config images.formats ['image/webp','image/avif'].
  - GENERATE-BUTTON UX: search empty state (search-miss only; chip/collection empty unchanged) → "Kya Arti aapke liye yeh recipe banaye?" + 🎬 saffron CTA (auth via useUser().isSignedIn — first client-side Clerk hook in app, works) or "Login karke try karein →" (guest → /sign-in). POST /api/recipes/generate requires non-empty ingredients, so search sends ingredients:[query] + query. Fridge CASE 2 already HAD a generate button — relabeled "🎬 YouTube Recipe Banao" + now passes query=chips joined ', '.
  - FOOTER: thin strip inside (main)/layout.tsx <main> after PageTransition — "Built with ❤️ by Aman · Maa ke liye 🍳" (10px, links amankeshri.com). Auto-excluded from admin/onboarding/sign-in (different route groups).
  - SAVED RECIPES UI: profile/page.tsx queries recipe_saves(recipes(*)) by CLERK id (recipe_saves.user_id stores clerk_user_id, NOT users.id UUID) limit 20 → ProfileClient savedRecipes prop → "❤️ Saved Recipes" 2-col RecipeCardCompact grid between subscription card and PWA install. Hidden when empty (by design).
  - Commit cdc4876, pushed main, deployed prod dpl_9TcebtUyNqzdAWNDRvJosjBuhNSA. /home + /search 200, footer text verified live. tsc + build clean.

SESSION 28 ✅ — search fix, YouTube CASE-2 pipeline, recommendations, 7Q onboarding, admin-only photos, tehri-fix
  - SEARCH FIX ("Rice→3 / Egg curry→Malai Kofta"): TWO root causes. (a) Egg Curry row was diet_type='non-veg' in DB → eggetarian users (filter veg+egg) never saw it — fixed via SQL UPDATE to 'eggetarian'. (b) direct SQL match didn't translate EN→HI: search route now builds nameTerms/tagTerms via INGREDIENT_EN_TO_HI (rice→chawal), name match uses .or(ilike per term), tag match uses .overlaps, vector-fill threshold raised <3→<6. Verified local: Rice→8, paratha→9. ADMIN "users not updating" was NOT a bug — verified live /admin/users via cookie login: all 5 users + same-day cook shown; Naman simply has zero cooking_history and recipes_pending is empty.
  - TEHRI FIX + ROOT CAUSE KILLED: Tehri thumbnail was a USER photo — the post-cook prompt POSTed to /api/recipes/[id]/thumbnail which OVERWROTE recipe thumbnails. That route is DELETED. Tehri regenerated via generate-thumbnails.ts (gpt-image-1) → CloudFront URL, verified 200.
  - COMMUNITY PHOTOS NOW ADMIN-ONLY: CommunityPhotos.tsx display-only (props: just recipeId); post-cook upload prompt + handlePhotoUpload removed from RecipeDetailClient; POST removed from /api/recipes/[id]/photos (GET stays). NEW POST /api/admin/recipes/[id]/photo (cookie-gated, validateFoodPhoto, S3 community/{recipeId}/admin-*.jpg, recipe_photos.user_id='admin' — column is TEXT not FK). /admin/photos has recipe-select + upload button.
  - DB MIGRATIONS (Aman ran in SQL editor): users + cooking_for/cooking_skill/time_preference/kitchen_setup(text[])/onboarding_v2_done, diet check now includes vegan/jain; recipes + recipes_pending both have youtube_video_id/url/channel_name. types/index.ts updated in lockstep (DietType+vegan/jain, CookingFor/CookingSkill/TimePreference types, preferred_region widened to RegionOrigin|string|null).
  - 7Q ONBOARDING (onboarding/page.tsx rewrite): welcome step 0 kept → Q1 cooking_for, Q2 diet (5 opts incl vegan/jain), Q3 region (9 opts incl south-indian/bengali/gujarati/maharashtrian/any — these DON'T exist in recipes.region_origin; RAG just never fires the region boost for them), Q4 spice (💀 saves 'hot' — SpiceLevel has no very-hot), Q5 skill, Q6 time, Q7 kitchen multi-select (slugs gas-stove/induction/microwave/air-fryer/pressure-cooker; "Sab kuch" selects all 5). family_size question REMOVED — derived server-side from cooking_for (alone 1/couple 2/family 4/pg 1) in BOTH onboarding + preferences routes. Submit sets onboarding_done + onboarding_v2_done → /onboarding/done. Existing users (v2_done=false) NOT re-onboarded — they edit via profile "⚙️ Meri Preferences" (per-question bottom-sheets, PATCH /api/users/preferences now validates all 7 fields + preferred_unit).
  - RECOMMENDATIONS: GET /api/recipes/recommendations — last 3 distinct cooked → up to 3 similar each (curated, diet/vrat-filtered, .or(category|region|spice), recently-cooked excluded, dedup across groups), reason "X banaya tha, toh yeh try karein"; guests/no-history get single popular group (based_on_recipe='' — home filters those out). HomeClient shows max 2 genuine groups below "Aaj ke liye" when cookedCount>=1. PostCookSuggestions ("Yeh bhi try karein 🍳") renders in RecipeDetailClient when cooked=true (?recipeId= biases group order).
  - YOUTUBE CASE-2 PIPELINE (cost ₹4→~₹0.5/recipe): src/lib/youtube.ts uses plain fetch REST (NOT googleapis — too heavy for serverless) with env YOUTUBE_DATA_API (NOT YOUTUBE_API_KEY); searchYouTubeRecipe (hi/IN, medium duration excludes shorts, stats matched by video id, >10k views) + extractTranscript (youtube-transcript pkg v1.3.1, hi→any fallback, 4000-char cap), all failures return null (quota exhaustion can't 500). generate-recipe.ts: shared parseAndValidateRecipe, extractRecipeFromTranscript on gpt-4o-MINI, generateRecipeViaYouTube orchestrator (any miss → old generateRecipe fallback, logs [yt-pipeline]). Both /api/recipes/generate + bacha-hua/suggest use it and store youtube_* on recipes_pending; pending→recipes promotion (pending/[id]/cook) now carries youtube_* through. NEW dish-name dedup in generate route: pending with same name_hinglish <30d → append user to shown_to_user_ids, return existing (BEFORE per-user 24h dedup + rate limit — save once serve many). YouTubeEmbed component (📺 Video Dekho + channel credit, 16:9 lazy iframe) renders in RecipeDetailClient below "goes well with" when recipe.youtube_video_id. Smoke-tested live: paneer butter masala → Your Food Lab (13.5M views) + hindi transcript.
  - RAG PERSONALISATION (lib/rag.ts re-rank, all SOFT boosts/penalties, never hard-filters): time_preference 15min/30min ±score, beginner boosts jaldi-bane/one-pot & penalizes dum, kitchen_setup lacking pressure-cooker penalizes dum/pressure-cooker-tagged. search + bacha-hua user selects extended with the 3 new fields (chat route untouched — optional fields).
  - ENV: YOUTUBE_DATA_API in .env.local; must also be in Vercel prod.

SESSION 27 ✅ — 5 bug fixes, Sentry+PostHog, full admin panel, CloudFront CDN live
  - BUG 1 SEARCH (route + page): direct SQL match now runs BEFORE vector search in api/recipes/search — ilike name_hinglish + tags-contains (both diet/vrat-filtered: veg→veg only, eggetarian→veg+egg, vrat→vrat-friendly), exact-name > partial > tag priority, vector fill only when <3 direct hits (saves embedding calls), full RAG fallback when zero direct. search/page.tsx now sends the RAW query; buildHinglishQuery moved server-side and applies ONLY to the vector path. Verified live: paratha→6 parathas, aloo→aloo dishes. NOTE: veg guests correctly DON'T see Chicken Biryani (only biryani in DB) — that's the diet filter, not a bug.
  - BUG 2 PORTION: seat-tap state logic was already correct (verified in browser). Real fixes: (a) free users with family_size>6 started above the cap — portionSize init now clamps to min(family_size,6) for free; (b) the hydration mismatch below was killing first-load taps on slow phones.
  - BUG 3 RATINGS: backend stored fine (verified rows + avg sync in DB). Real bug: rating UI gated on session-only `cooked` state → revisits could never rate. recipe/[id]/page.tsx now queries cooking_history server-side and passes hasCookedBefore; section shows on (cooked || hasCookedBefore). users select now includes id.
  - BUG 4 TTS + HYDRATION ROOT CAUSE: TTSButton returned null on server (typeof window check in render) → server/client tree mismatch → full client regen on every recipe page load. Rewritten: always renders, hides post-mount if unsupported. NEW src/lib/tts.ts — speakText/stopSpeaking/isTTSSupported with hi→en-IN→default voice fallback, onvoiceschanged + 250ms timeout guard (some Androids never fire it), rate 0.85. Both TTSButton and inline cooking speakStep use it.
  - BUG 5 SCROLL: PageTransition now scrollTo(0,instant) on pathname change; RecipeDetailClient also resets on mount.
  - MONITORING: @sentry/nextjs (sentry.client/server.config.ts + instrumentation.ts + instrumentation-client.ts, enabled only when NEXT_PUBLIC_SENTRY_DSN set — DSN still EMPTY, Aman must create sentry.io project); next.config wrapped withSentryConfig (sourcemaps disabled w/o SENTRY_AUTH_TOKEN). Sentry.captureException in chat/message, fridge/scan, fridge/validate, recipes/search, recipes/generate; chat/message + fridge/validate + fridge/scan now have whole-route try/catch (Hinglish 500s, guard statuses preserved). posthog-js + PHProvider (src/components/PHProvider, wraps root layout inside ClerkProvider) + src/lib/analytics.ts (trackEvent/identifyUser — not yet called anywhere). NEXT_PUBLIC_POSTHOG_KEY pushed to Vercel prod.
  - ADMIN PANEL (cookie auth, NOT Clerk; dark navy #1A1A2E/#16213E + saffron): src/lib/admin-auth.ts (sha256 token, timingSafeEqual, requireAdmin per-PAGE not layout — login page shares layout); /api/admin/{login,logout,verify,recipes,recipes/[id],users/[id],users/[id]/history,pending/[id]/approve,pending/[id]/reject,push/send,photos/[id]} all cookie-gated; pages /admin{,/login,/recipes,/recipes/new,/recipes/[id]/edit,/users,/pending,/push,/photos,/analytics}. Recipe create/edit re-embeds via api/admin/_lib/embedding.ts (replica of seed-recipes embedding_text). Approve mirrors pending-cook promotion (source 'curated'). push/send loops sendPushToUser + logs to NEW push_logs table (migration create_push_logs applied). proxy.ts: /admin(.*) + /api/admin/(.*) public to Clerk, early-return sets X-Robots-Tag noindex. ADMIN_PASSWORD in .env.local + Vercel prod (generated 3d8887cb5e1293540fdfd3b7). Analytics page = DB quick stats + PostHog link-out (iframes blocked). Dashboard "chat messages today" shows "—" (Redis-only, not tracked).
  - CLOUDFRONT: Aman created distribution chef-AI-Arti-CDN → drj954v3cskcn.cloudfront.net (verified 200 on thumbnail). CLOUDFRONT_DOMAIN in .env.local + Vercel; next.config remotePatterns reads it (S3 fallback). docs/cloudfront-setup.md has the full guide. DB thumbnail_url rewrite SQL run AFTER deploy (old deploy lacked CF host in remotePatterns) — see commit notes; if thumbnails ever 404 via CF, check S3 key vs distribution origin.
  - Dev-server note: `npm run dev` FAILS on Next 16 (Turbopack rejects webpack config) — use `npx next dev --webpack`.

SESSION 26 ✅ — Backend audit (9/10, zero P0) + home/recipe/search UI redesign + shared motion system
  - AUDIT: tsc + `next build --webpack` clean; 29 API routes all auth'd or self-guarded (cron/push-send via CRON_SECRET, webhook via HMAC); prod endpoints 200/401 as expected; all 19 required Vercel env vars present (ADMIN_PASSWORD N/A — no /api/admin routes exist); Redis PONG; Supabase recipes=150 with 150/150 thumbnails (thumbnail backfill from session-25 PENDING note is DONE); RLS ON for users/cooking_history/subscriptions/ratings/photos/push_subs, OFF for recipes/recipes_pending (service-role-only design, accepted); validateFoodPhoto + generate rate-limit + webhook signature all verified; no live-key secrets in client code.
  - HOME (HomeClient.tsx): QuickActions strip + Chef Arti promo card REPLACED by "Kya karna hai? 🍳" feature grid — 2×2 gradient cards (Fridge Scan saffron, Chef Arti purple, Bacha Hua green, Aaj ki Thali violet) + full-width Surprise row (ported surprise→/recipe/[id] handler). Sticky white header now has "🍳 Chief-AI-Arti" brand + VratToggle + search bar; #FFF0E6 greeting card (Playfair terracotta "Namaskar, [name]! 🙏"). "Aaj ke liye" cards 160×190 (65% image / name 11px / time 9px). All cards card-entry stagger + tap-spring.
  - RECIPE DETAIL (RecipeDetailClient.tsx): 260px hero (scale 1.05→1.0 entry, gradient overlay, Playfair white title, vibe pills on image), info-pill scroll row, 56px saffron-gradient "Banana Shuru Karein" CTA → INLINE cooking mode (active step #FFF0E6 + saffron border-left, done ✓ green 0.6 opacity, future 0.4, step counter, Pichla/Agla 48px nav, per-step 🔊 TTS, last Agla → handleCooked). "🧂 Samagri" = 2-col emoji ingredient cards via NEW src/lib/emoji.ts getIngredientEmoji() (~45 Hinglish+English mappings, reusable). "📋 Vidhi" numbered step cards. Full-screen CookingMode DELETED (src/components/CookingMode/ removed; cooking is inline-only now). Portion selector/ratings/photos/nutrition/save/login-gating all preserved.
  - SEARCH (search/page.tsx): chips saffron-fill active + scale(1.02), "X recipes mili" count label, warm 🍲 empty state, results grid keyed by query/filter with staggered card-entry (cap 12).
  - MOTION SYSTEM (globals.css "Session 26: shared motion system" block): .page-enter .card-entry .stagger-1..6 .tap-spring .slide-up .fade-in .heart-pop .float-slow. NEW src/components/PageTransition/PageTransition.tsx (client, key=pathname, page-enter) wraps {children} inside (main)/layout.tsx <main> — BottomNav/Toaster outside, layout stays server. Onboarding Q-cards use page-enter; tap-spring added to fridge/bacha-hua/thali buttons; last raw spinner (BachaHuaClient) replaced with ArtiLoader.
  - DELETED: src/components/CookingMode/, src/components/QuickActions/, src/components/RecipeCard/RecipeCardGrid.tsx (all zero importers), home-redesign.jpeg.
  - ALSO SWEPT IN: pre-existing uncommitted ProfileClient.tsx change removing the saved-recipes list from profile (Aman confirmed intentional — saved recipes currently have NO display UI; /api/recipes/saved + save buttons still exist, surface them somewhere in a future session).
  - NOT phone-tested (manual tests a-j pending on Aman's real device).

SESSION 25 ✅ — Infra/UX fixes + 100 new recipes (DB 50→150) + 30 knowledge chunks (116→146)
  - SCHEMA CORRECTION (important): the session-25 generation spec used emoji vibe labels (e.g. 'Halki Dish 🌿') and hyphenated regions ('UP-Bihar','Punjab-Haryana','Rajasthan-MP'), plus 'soup'/'achaar' categories — NONE of these exist in the real schema. Actual values come from src/types/index.ts: vibes are kebab `VibeBadgeKey` slugs (halki-dish, taakat-wali, jaldi-bane, bacchon-ki-fav, tyohar-special, teekha-alert, vrat-wali, comfort-food, tiffin-ready, monsoon-special, sardi-warmth, garmi-cool, protein-rich, one-pot, leftover-friendly, guest-special, bujurg-friendly, low-oil, bina-pyaz-lehsun); region_origin is a single value (UP|Bihar|Jharkhand|Delhi-NCR|Punjab|Haryana|Rajasthan|MP|Bengal|Uttarakhand|pan-north-indian); RecipeCategory is ONLY sabzi|dal|roti|chawal|nashta|meetha. Soups/shorba were filed as category 'dal' (tags soup/shorba); achaar/chutney as category 'sabzi' (tags achaar/chutney). All 100 recipes use the correct enum values.
  - PHASE 1 (commit def7a2d "session-25: infra, icons, ux-fixes"): vercel.json `regions:["bom1"]`; scripts/resize-icons.ts (sharp-based, reads public/icon-new.png|app-icon.png → writes icon-192/512 — NO new icon was present so nothing resized; existing icons are real 5KB/15KB canvas art, not 1×1 placeholders, so the "PWA icons are placeholders" note below is STALE/wrong); aaj-ki-thali "Yeh theek hai ✓" confirm button + localStorage `aaj_ki_thali_{userId}_{date}` + reset (page.tsx now passes userId); chat/message route — empty/'general' recipeName now yields current_recipe=null and renders "{current_recipe}" as "Koi specific recipe nahi — general baat-cheet"; seed-recipes.ts gained --file / --knowledge-file / --knowledge-only / --recipes-only flags for batch seeding.
  - PHASE 2 — 100 recipes via 4 parallel subagents (a=25 sabzi, b=gravy/dal/soup/achaar, c=25 roti/chawal/meetha, d=26 nashta/vrat/meetha). Agents b & d hit a session limit mid-run; orchestrator authored the missing 17 (12 dal + 3 shorba + aam/nimbu achaar + lehsun chutney) plus 3 region-fillers (Hara Choliya/Haryana, Bhutte ka Kees/MP, Ram Ladoo/Delhi-NCR). Files: scripts/seed/recipes-batch2{a,b,b-extra,c,d}.json → validated + deduped + merged by scripts/validate-batch2.ts into scripts/seed/recipes-batch2.json (the canonical batch-2 seed). recipes.json (batch 1) left untouched. Final mix: sabzi 38, dal 14, nashta 17, roti 12, chawal 9, meetha 10; vrat 12; regions pan 46/UP 15/Punjab 12/Rajasthan 10/Bihar 8/MP 4/Haryana 2/Delhi-NCR 2/Uttarakhand 1.
  - PHASE 3 — 30 knowledge chunks (Bihar 8, Rajasthan 6, Punjab 6, seasonal/festival 10) in scripts/seed/knowledge-batch2.json, also appended into knowledge.json (now 146). Unique ids, no PK collisions.
  - SEEDING: `npx tsx scripts/seed-recipes.ts --file scripts/seed/recipes-batch2.json` (live) → 100 seeded, 0 failed. `--knowledge-file scripts/seed/knowledge-batch2.json` (live) → 30 seeded, 0 failed. Verified in Supabase: recipes total=150 (all curated, 0 missing embeddings, vrat=18), knowledge_docs=146.
  - PENDING: thumbnail generation for the 100 new recipes (scripts/generate-thumbnails.ts, ~$4 via gpt-image-1) — NOT run, waiting on Aman's go. tsc/build/deploy status: see commit notes when pushed.
  - validate-batch2.ts is a reusable validator/merger (enum checks, scale_type, vibe auto-fix, oil≤3 chammach, vrat onion/garlic rules, cross-file + existing-50 dedup).

SESSION 23 ✅ — Home declutter, search becomes discovery page, thumbnail gen, spacing, bug fixes
  - THUMBNAILS: Aman ran scripts/generate-thumbnails.ts himself (OpenAI org now verified, gpt-image-1). Real food photos now live for curated recipes. No code change needed for this — S3 URLs are direct in recipes.thumbnail_url.
  - HOME RESTRUCTURE (HomeClient.tsx + home/page.tsx): REMOVED the 2-col RecipeCardGrid feed, the inline free-tier upgrade card, and the category-filter chips. NEW layout: sticky greeting+vrat header → tappable search bar (→/search) → QuickActions strip → "🍽️ Aaj ke liye" horizontal 4-card strip (new inline FeaturedCard, 160×180, image-top/text-bottom, top-4 by cooked_count filtered by vrat + diet where veg users see veg-only, non-veg/egg see all) → "🍳 Aapki Chef Arti" promo card (→/chat) → "🍲 100+ recipes explore" teaser shown when unauth or cooked_count<5. home/page.tsx now also fetches cooking_history count and passes dietType + cookedCount. RecipeCardGrid.tsx is now orphaned (no importers) but left in place.
  - SEARCH (search/page.tsx): already loaded a default top-20 grid on mount; added the "📋 Sab Recipes" default heading for the none-state, bumped grid gap 8→14px (gap-3.5) + pb-24, Food Library section mb 16→24px. Bug 4 (empty space below Food Library) resolved by the default grid that was already present.
  - BUG FIXES: (1) api/recipes/[id]/photos POST — DELETED the auto-set-thumbnail-from-first-community-photo block (root cause of Bhindi Sabzi showing a Surf Excel product photo). Thumbnails now ONLY from generate-thumbnails.ts; added explanatory comment. (2) onboarding/done/page.tsx — non-veg/eggetarian users now match diet_type IN ('non-veg','eggetarian','veg') (a mix), veg users stay veg-only; applied to both personalized query and fallback. (3) /chat page — added "Recipes dekhein →" CTA to /home (kept the standalone FloatingChatButton; not a hard redirect).
  - VERIFIED: tsc clean, `next build --webpack` clean. Pushed main f010055. Deployed prod dpl_9HCkBK64iEyHhuNREEhrzW8Jvn5a. arti.amankeshri.com /home + /search both 200. NOT browser-tested (need auth): onboarding/done mix, /chat CTA, home featured filtering with a logged-in diet.
  - Commit: f010055. home-redesign.jpeg (design reference screenshot) left untracked.

SESSION 22-UI ✅ — Warm Rasoi redesign (onboarding + upgrade flow + home) + paid chat rate-limit fix
  - PAID CHAT FIX: root cause was NOT the server (route + RATE_LIMITS.paid.chat=20 were already correct). The /chat page rendered `<FloatingChatButton />` with no subscriptionStatus → defaulted 'free' → UI capped at 3. Fix: converted /chat to a server component that fetches subscription_status and threads it. Commit 3c66ffb.
  - FOUNDATION (orchestrator-laid, to avoid parallel-agent collisions): Playfair Display font added in layout.tsx (.font-display / --font-playfair). globals.css :root Warm Rasoi tokens (--saffron #E8640C, --saffron-dk, --saffron-lt #FFF0E6, --cream #FFF8F0, --terracotta #C4621E, --green #2D6A4F, --text, --muted, --border #E8D5C0, --shadow). Shared keyframes: floatUp, fadeInUp, cardEntry, emojiBurst, drainBar + utility classes .animate-fade-in-up / .animate-card-entry.
  - ONBOARDING: welcome screen (step 0, floating 🥔🍅🧅, auto-advance 2.5s) before Q1; redesigned Q1-Q3 option cards (spring select, saffron-lt fill, checkmark, region color dots); NEW /onboarding/done route (server page.tsx + DoneClient.tsx) — emoji burst + 3 personalized recipe cards. Final onboarding submit now router.push('/onboarding/done') not /home.
  - DONE QUERY: onboarding stores broad buckets (preferred_region: UP-Bihar/Delhi-NCR/...); recipes use granular region_origin. done/page.tsx has REGION_MAP bucket→region_origin[], filters diet_type + in(region_origins + 'pan-north-indian'), 3-tier fallback (region+diet → diet-only → any curated).
  - UPGRADE: ChatWindow rate-limit banner rewritten (remaining===0+free → benefit card w/ "chai ka ek cup" line + CTA + "Kal free mein jaari rakhein" skip; ===1 → subtle yellow; >=2 → nothing). UpgradeModal full warm bottom-sheet rewrite — IMPORTANT BEHAVIOR CHANGE: subscription-create now fires on CTA tap (checkoutStarted flag), NOT on modal open. Premium success state: emoji burst + delayed text + "ghar chalein" button + 5s drainBar auto-close. Razorpay create→checkout.js→handler logic unchanged.
  - HOME: StoryCircles merged into QuickActions single scroll row (5 feature cards + category chips driving existing categoryFilter state). StoryCircles.tsx DELETED (orphaned). Recipe grid stagger entry (.animate-card-entry, +60ms each, cap 8). Time-of-day greeting (computed in useEffect to avoid hydration mismatch).
  - VERIFIED: tsc clean, `next build --webpack` clean, PWA sw.js regenerated (NetworkOnly present). Deployed prod dpl_37a1s3kZwVWkRqm5n4ox9fMpinRs. /home 200 + 0 console errors in browser. NOT browser-tested (need auth/paid account): onboarding welcome/done, chat banner, upgrade modal, payment success.
  - Commits: 3c66ffb (chat fix), dd4215c (UI redesign). Pushed main. CONSTRAINT NOTE: agents did UI-only, no API/DB/lib changes.

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

## SESSION 13 ✅ — Root URL fix, Instagram grid, story circles, fridge/openai fixes, DALL-E script
- page.tsx: / → /home (no login required at root URL)
- RecipeCardGrid: square full-bleed card with gradient overlay, vrat dot, text at bottom
- StoryCircles: horizontal scroll category filter (Sab/Sabzi/Dal/Chawal/Nashta/Vrat/Meetha)
- HomeClient: 2-col grid, every-5th featured (2:1 span), tappable search bar → /search
- search/page.tsx: 2-col grid results using RecipeCardGrid
- openai.ts: detail:'low' on vision calls, regex JSON parsing (strips markdown fences)
- validate/scan routes: console.log for debugging image size and extraction results
- scripts/generate-thumbnails.ts: DALL-E 3 batch script — run with `npx tsx scripts/generate-thumbnails.ts` (~$2 for 50 recipes)
- sign-in page: Clerk 429 rate-limit caught, shows Hinglish error instead of silent crash
- .gitignore: added .playwright-mcp/
- Git commit: df6047b + bb10eff

## SESSION 22 ✅ — SW regeneration fix (next-pwa→@ducanh2912 + webpack build), promotion source fix, audit
- ROOT CAUSE of stale SW: Next 16 `next build` defaults to **Turbopack**, which ignores next-pwa's webpack plugin. public/sw.js was frozen for several sessions → session-18 search-cache fix never actually shipped.
- FIX: uninstalled next-pwa 5.6, installed @ducanh2912/next-pwa 10 (maintained for Next 16). next.config.ts rewritten: runtimeCaching/skipWaiting/importScripts now under `workboxOptions`, added reloadOnOnline + cacheOnFrontEndNav.
- Build now uses `next build --webpack` (package.json script + vercel.json `buildCommand`) so the PWA webpack plugin runs. Verified: `(pwa) Service worker` logs, sw.js regenerated, search NetworkOnly + importScripts(/push-sw.js) both ship. Confirmed in PROD: deployed /sw.js is freshly generated (NetworkOnly=1, push-sw import present), /swe-worker-*.js 200.
- ITEM-1 FIX: /api/recipes/pending/[id]/cook promotion now inserts source='curated' (was 'ai', which schema.sql:122 forbids and which hid promoted recipes from /surprise + emptyStateFallback that filter source='curated').
- AUDIT findings still open: push_subscriptions RLS OFF (consistent w/ app's service-role-only design, not a live vuln); PWA icons still 1×1 placeholders; S3 thumbnail public-read ACL; paid chat still 3/day; CASE2 dedup ingredient-blind. Stale CLAUDE.md lines (search "placeholder", "recipes_pending no API route") are now BUILT — ignore those.
- Commits: 67daa32 (SW fix + source fix). Pushed to GitHub (main @ 67daa32). Deployed prod.

## SESSION 19 ✅ — Home QuickActions, Bacha Hua leftover mode, CASE 2 recipe generation
- QuickActions: 80×90px horizontal-scroll strip on home (between StoryCircles and grid). 5 gradient cards: Fridge Scan→/fridge, Bacha Hua→/bacha-hua, Chef Arti→/chat, Surprise!→surprise API then /recipe/[id], Dhundhon→/search
- /chat placeholder page ((main) group) — renders FloatingChatButton with a Hinglish prompt to open chat
- src/lib/generate-recipe.ts: shared GPT-4o helper. generateRecipe(ingredients, query?) → GeneratedRecipe {name_hinglish, description, ingredients, steps, cook_time_minutes, vibes, tags}. json_object response_format, strict validation (throws if name/ingredients/steps missing)
- Bacha Hua (PAID ONLY): /bacha-hua server page (auth→sign-in, fetch subscription_status) + BachaHuaClient. Free users → upgrade wall + UpgradeModal. Paid → 3-state (select chips → loading → results). 10 pre-defined leftover chips + "Kuch aur..." custom input. Multi-select, 1-5 items.
- /api/bacha-hua/suggest POST: auth→user lookup→403 if free→validate 1-5→buildHinglishQuery→searchRecipes (CASE 1). triggerCase2/empty → generateRecipe → insert recipes_pending → return {recipes} or {generated:{pendingId,recipe}}
- /api/recipes/generate POST: auth→user→validate→DEDUP check (recipes_pending by requested_by within 24h, returns existing, BEFORE rate limit)→checkRateLimit('ai-gen', free 1/paid 5)→generateRecipe→insert recipes_pending (requester seeded into shown_to_user_ids)→{pendingId, recipe, isGenerated}
- /recipe/pending/[pendingId] page ((main) group, NOT a separate route group — avoids /recipe path conflict): server auth + owner-gate (user.id must be in shown_to_user_ids else notFound) → PendingRecipeClient (yellow ✨ Naya Recipe banner, ingredients/steps, "Bana liya!" → cook route, promotion progress)
- /api/recipes/pending/[id]/cook POST: cook-guard via shown_to_user_ids-as-cooked-set (handles requester's seeded-but-uncounted first cook; rejects double-cook). Does NOT touch cooking_history (FK to recipes(id) would violate for pending ids). Promotion at cooked_count>=3 AND reported_count=0 → INSERT recipes (source='ai', category='sabzi' default) → status='promoted'
- Fridge scan CASE 2 wired: triggerCase2 branch now offers "Haan, Arti se banwao!" → /api/recipes/generate → /recipe/pending/[id]
- IMPORTANT id rule reaffirmed: recipes_pending.requested_by + shown_to_user_ids use users.id (UUID), NOT clerk_user_id
- KNOWN LIMITATION: generate dedup returns ANY pending from last 24h regardless of ingredient similarity (per spec's crude dedup)
- PHASE 3 WEB PUSH ✅ (completed same session):
  - push_subscriptions table created via Supabase migration (id, user_id UUID UNIQUE FK→users.id, endpoint, p256dh, auth, created_at)
  - VAPID keys generated, in .env.local + Vercel prod env (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL). CRON_SECRET also in both.
  - src/lib/push.ts: sendPushToUser(userId UUID, payload) — web-push, prunes dead subs on 404/410
  - /api/push/subscribe POST: auth → upsert push_subscriptions by user_id
  - /api/push/send POST: internal, guarded by Authorization: Bearer CRON_SECRET
  - /api/cron/daily-nudge GET: CRON_SECRET-guarded, nudges 7-day-active users (distinct cooking_history.user_id). vercel.json cron "30 2 * * *" (8am IST)
  - PushNotificationButton in ProfileClient (below PWAInstallButton): permission + pushManager.subscribe + POST subscribe
  - proxy.ts: /api/cron/(.*) + /api/push/send made public (self-guard via CRON_SECRET)
  - push handlers live in static public/push-sw.js, pulled into the generated SW via workboxOptions.importScripts.
  - Verified in prod: cron 403, push/send 403, push/subscribe 401, push-sw.js 200, sw.js has importScripts line
- tsc clean, build clean. Deploys: dpl_3yFYCgo3Rttpd4pvewW9KsGYCLVG (P1+P2), dpl_Gnn6xwHyAV12iHUwgPJxetUqH22r (P3)
- Git commits: 08ff924 (quick actions), 0e0d13e (bacha hua + CASE 2), 28d3e7c (docs), 47c3c44 (web push)

## SESSION 18 ✅ — Mobile search fix (GET + SW), community photos
- Root cause: SW only intercepts GET; mobile PWA was running old precached search page JS (pre-session-17)
- FIX A: Search API now has GET handler (params: q, category, tag, vrat, orderBy, vibe, limit); POST kept
- FIX B: next.config.ts explicit runtimeCaching — NetworkOnly for /api/recipes/search
- FIX C: search input type="search", inputMode="search", enterKeyHint="search", Enter key fires immediately, debounce 600ms
- FIX D: SWUpdater component in layout.tsx forces SW update check on every app open
- fetchByFilter in search/page.tsx converted from POST to GET with URLSearchParams
- recipe_photos table created (Supabase) — id, recipe_id, user_id, s3_url, is_public, created_at
- /api/recipes/[id]/photos GET: returns 20 most recent public photos
- /api/recipes/[id]/photos POST: auth + cooking_history gate + S3 upload to community/ prefix + auto-sets thumbnail if missing
- CommunityPhotos component: horizontal scroll, lightbox (no library), upload button (only if hasCooked)
- RecipeDetailClient: CommunityPhotos wired after vibes, before portion slider
- Git commit: see below

## SESSION 17 ✅ — Search fix (buildHinglishQuery), recipe ratings (1-5 stars)
- Search bug fixed: search/page.tsx now splits searchTerm, runs buildHinglishQuery before embedding
- ingredient-map.ts: +35 entries (lentil, bread, curry, paratha, biryani, kheer, etc.)
- src/types/index.ts: avg_rating + rating_count added to Recipe interface
- src/lib/rag.ts: RpcRecipeRow updated with avg_rating/rating_count; rowToRecipe defaults to 0
- /api/recipes/[id]/rate POST: auth + cooking_history check + upsert + sync avg/count to recipes
- /api/recipes/[id]/rating GET: returns user's existing rating (pre-fills stars on revisit)
- StarRating component: interactive (tap to rate) + display (show avg, muted) variants
- RecipeCardGrid + RecipeCardCompact: show "⭐ 4.2" when rating_count >= 3
- RecipeDetailClient: avg rating below title, rating prompt after "Bana liya!", pre-fill on revisit
- Git commit: see below

## SESSION 16 ✅ — Nutrition macros: DB column, GPT-4o estimation, UI display
- DB: `nutrition JSONB` column added to recipes (Supabase SQL Editor)
- src/types/index.ts: Recipe.nutrition field added (optional, full typed shape)
- scripts/estimate-nutrition.ts: GPT-4o batch estimator (--dry-run, --force, 300ms throttle)
- scripts/verify-nutrition.ts: quick DB verification helper
- src/components/NutritionDisplay/NutritionDisplay.tsx: scaled macro bars (P/C/F/Fi),
  heaviness label per person, "X logon ke liye total" label, low-confidence note
- RecipeDetailClient: NutritionDisplay wired after ingredients, before steps
- 50 recipes estimated, 0 failures. Ranges: Lauki Sabzi 100 kcal (halka) → Malai Kofta 550 kcal (bhaari)
- Surprising: Khichdi 350 kcal (bhaari) — expected lighter; Malai Kofta 550 kcal — expected
- Git commit: 1f5376c

## SESSION 15 ✅ — Back navigation system, search redesign, Food Library
- src/hooks/useBackNavigation.ts: reusable hook — router.back() or router.push(fallback)
- src/components/BackButton/BackButton.tsx: reusable back button (arrow/x variant, custom onClick support)
- RecipeDetailClient: overlay back + save buttons on hero image (absolute positioned, blurred bg)
- fridge/page.tsx: back button in all 3 states (capture→/home, review→capture, results→review)
- profile/ProfileClient.tsx: back button + "Mera Profile" heading at top
- sign-in page: X close button shown when redirect_url search param is present
- onboarding page: already had ← Wapas on Q2 and Q3 — no change needed
- src/lib/collections.ts: 6 curated collections (Top Recipes, Jaldi Bane, Vrat Special, Nashta, Halka Khana, Meetha)
- src/components/CollectionCard/CollectionCard.tsx: 80×80px card, colored emoji bg, active ring
- src/components/RecipeCard/RecipeCardCompact.tsx: 3:2 ratio compact card for search results
- search/page.tsx: full redesign — back button, Food Library horizontal scroll, 2-col compact grid, default top-20 load
- api/recipes/search/route.ts: filter-only path added (no query + filters → SQL only, no embedding)
- Git commit: see below

## Phase 2 Status

  PHASE 1: Complete ✅ (Sessions 1-14)
  PHASE 2: In progress (Session 15+)

  Phase 2 features planned:
  - Back navigation system (Session 15 ✅)
  - Search page redesign — Food Library (Session 15 ✅)
  - Nutrition macros — GPT-4o estimate, JSONB, scaled UI (Session 16 ✅)
  - Search fix + recipe ratings 1-5 stars (Session 17 ✅)
  - Mobile search fix (GET+SW+input) + community photos (Session 18 ✅)
  - Recipe rating system (Session 17)
  - Community cooked photos (Session 18)
  - Home QuickActions strip (Session 19 ✅)
  - Bacha Hua leftover mode (Session 19 ✅)
  - New recipe generation CASE 2 (Session 19 ✅)
  - Web Push notifications (Session 19 ✅)

## Phase 2 DB Changes Needed
(not yet applied — Session 16 will run these)

  ALTER TABLE recipes ADD COLUMN nutrition JSONB;
  ALTER TABLE recipes ADD COLUMN avg_rating DECIMAL(3,2) DEFAULT 0;
  ALTER TABLE recipes ADD COLUMN rating_count INTEGER DEFAULT 0;
  CREATE TABLE recipe_ratings (...) -- see full schema in session 17

## What's Built — Every File in src/

### src/lib/
- `supabase.ts` — createServerClient() (service role, server-only), createBrowserClient() (anon)
- `openai.ts` — VISION_MODEL, CHAT_MODEL, SUMMARY_MODEL, EMBEDDING_MODEL constants; getEmbedding, validateImage, extractIngredients, chatCompletion
- `redis.ts` — checkRateLimit, getRateLimitRemaining; chat session with 3hr TTL; compressAndUpdateSession. Re-exports RATE_LIMITS from rate-limits.ts.
- `rate-limits.ts` — RATE_LIMITS constant only (no server deps — safe to import in client components)
- `portion.ts` — scaleIngredients (pure math, non-linear scaling), shouldShowScalingWarning
- `rag.ts` — searchRecipes (full RAG pipeline: embed → RPC → re-rank → top 3)
- `knowledge.ts` — searchKnowledge (embed → RPC → top 3), hasSafetyFlag
- `collections.ts` — RECIPE_COLLECTIONS (6 curated browse collections with filters)

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
