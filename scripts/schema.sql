-- Chief-AI-Arti — Supabase Schema (Phase 1)
-- Run this in Supabase SQL Editor to initialize the database.
-- Order: extensions → tables → indexes. Idempotent where possible (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────
-- USERS
-- ─────────────────────────────────────
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id        VARCHAR UNIQUE NOT NULL,
  name                 VARCHAR(100),
  phone                VARCHAR(15),
  diet_type            VARCHAR(20) DEFAULT 'veg',     -- 'veg' | 'non-veg' | 'eggetarian'
  restrictions         TEXT[] DEFAULT '{}',           -- ['dairy-free','nut-allergy']
  family_size          INTEGER DEFAULT 4,
  preferred_unit       VARCHAR(20) DEFAULT 'desi',    -- 'desi' | 'metric'
  is_vrat_mode         BOOLEAN DEFAULT false,
  subscription_status  VARCHAR(20) DEFAULT 'free',    -- 'free' | 'paid'
  subscription_ends_at TIMESTAMPTZ,
  razorpay_sub_id      VARCHAR(100),
  onboarding_done      BOOLEAN DEFAULT false,
  spice_preference     VARCHAR(10) DEFAULT 'medium',  -- 'mild' | 'medium' | 'hot'
  disliked_ingredients TEXT[] DEFAULT '{}',           -- ['karela','baingan']
  preferred_region     VARCHAR(30),                   -- e.g. 'UP','Bihar','Punjab'
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN users.clerk_user_id        IS 'External Clerk auth user ID — primary lookup key from auth middleware.';
COMMENT ON COLUMN users.diet_type            IS 'One of: veg | non-veg | eggetarian. Filters recipe candidates.';
COMMENT ON COLUMN users.restrictions         IS 'Free-form dietary restriction tags (allergies, intolerances).';
COMMENT ON COLUMN users.preferred_unit       IS 'desi (katori/chamach) vs metric (g/ml) — controls qty rendering.';
COMMENT ON COLUMN users.is_vrat_mode         IS 'When true, only vrat-friendly recipes are returned (fasting).';
COMMENT ON COLUMN users.subscription_status  IS 'free | paid — gates premium features and rate limits.';
COMMENT ON COLUMN users.razorpay_sub_id      IS 'Latest Razorpay subscription ID mirrored from subscriptions table for fast access.';
COMMENT ON COLUMN users.onboarding_done      IS 'Gates app entry; false means redirect to /onboarding.';
COMMENT ON COLUMN users.spice_preference     IS 'mild | medium | hot. Drives retrieval re-rank + prompt context.';
COMMENT ON COLUMN users.disliked_ingredients IS 'Filtered out at SQL pre-filter stage. User-managed via profile.';
COMMENT ON COLUMN users.preferred_region     IS 'Optional regional cuisine preference — used as ranking boost only, not hard filter.';

CREATE INDEX users_disliked_ingredients_gin ON users USING GIN (disliked_ingredients);

-- ─────────────────────────────────────
-- RECIPES
-- ─────────────────────────────────────
CREATE TABLE recipes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_hinglish            VARCHAR(200) NOT NULL,
  name_hindi               VARCHAR(200),
  description              TEXT,
  category                 VARCHAR(50),   -- 'sabzi','dal','roti','chawal','nashta','meetha'
  meal_type                TEXT[] DEFAULT '{}',        -- ['lunch','dinner']
  diet_type                VARCHAR(20) DEFAULT 'veg',
  is_vrat_friendly         BOOLEAN DEFAULT false,
  excluded_items           TEXT[] DEFAULT '{}',        -- ['onion','garlic']

  -- JSONB: [{name:"Aloo", prep:"cubed", qty_desi:"2 katori", qty_metric:"200g",
  --          scale_type:"linear"|"salt"|"spice"|"oil"|"water"|"fixed"}]
  -- Note: `prep` is display-only; `name` is what gets embedded (semantic).
  ingredients              JSONB NOT NULL,

  -- JSONB: [{step:1, instruction:"Kadahi mein tel garam karo...", time_minutes:2}]
  steps                    JSONB NOT NULL,

  cook_time_minutes        INTEGER,
  prep_time_minutes        INTEGER DEFAULT 0,          -- soaking/chopping time before cooking
  soak_required            BOOLEAN DEFAULT false,      -- overnight-soak flag (rajma, chole, chana)
  base_family_size         INTEGER DEFAULT 4,

  spice_level              VARCHAR(10),                -- 'mild' | 'medium' | 'hot'
  cooking_style            VARCHAR(20),                -- 'sukha','tariwala','bhuna','dum','tadka-based','steamed','fried','roasted','boiled'
  region_origin            VARCHAR(30),                -- 'UP','Bihar','Punjab','Bengal','Rajasthan','pan-north-indian', etc.
  heaviness                VARCHAR(10),                -- 'halka' | 'medium' | 'bhaari'
  goes_well_with           TEXT[] DEFAULT '{}',        -- pairing hints: ['roti','jeera-rice','chaas']

  vibes                    TEXT[] DEFAULT '{}',
  tags                     TEXT[] DEFAULT '{}',
  thumbnail_url            VARCHAR(500),
  thumbnail_source         VARCHAR(20) DEFAULT 'none', -- 'none' | 'user' | 'ai'
  cooked_count             INTEGER DEFAULT 0,

  -- Quality signals — used for re-ranking in lib/rag.ts
  -- Computed quality_score (never stored — computed at query time):
  --   (cooked_count * 3) + (like_count * 2) + saved_count - (reported_count * 10)
  -- reported_count > 0 → deprioritise in RAG results
  -- reuse_count → how often a recipe is referenced from chat sessions
  like_count               INTEGER DEFAULT 0,
  saved_count              INTEGER DEFAULT 0,
  reported_count           INTEGER DEFAULT 0,
  reuse_count              INTEGER DEFAULT 0,

  embedding_text           TEXT,                       -- exact string used for embedding (reproducibility)
  embedding                VECTOR(1536),               -- text-embedding-3-small
  source                   VARCHAR(10) DEFAULT 'curated', -- 'curated' | 'ai' | 'user'

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN recipes.name_hinglish     IS 'Primary display name in Hinglish (Roman-script Hindi).';
COMMENT ON COLUMN recipes.name_hindi        IS 'Optional Devanagari name for users who prefer Hindi script.';
COMMENT ON COLUMN recipes.category          IS 'Coarse classification: sabzi | dal | roti | chawal | nashta | meetha.';
COMMENT ON COLUMN recipes.meal_type         IS 'Suitable meal slots — array of: breakfast | lunch | dinner | snack.';
COMMENT ON COLUMN recipes.is_vrat_friendly  IS 'Eligible when user has is_vrat_mode = true.';
COMMENT ON COLUMN recipes.excluded_items    IS 'Ingredient tokens a user may want to exclude (e.g. onion/garlic for satvik).';
COMMENT ON COLUMN recipes.ingredients       IS 'JSONB array. Each item: {name, prep?, qty_desi, qty_metric, scale_type}. `name` is semantic (embedded); `prep` is display-only.';
COMMENT ON COLUMN recipes.steps             IS 'JSONB array of ordered instructions with per-step time estimates.';
COMMENT ON COLUMN recipes.prep_time_minutes IS 'Pre-cook prep time (soaking, chopping). Separate from cook_time_minutes.';
COMMENT ON COLUMN recipes.soak_required     IS 'True for recipes that need overnight soak — surfaced in UI as a warning.';
COMMENT ON COLUMN recipes.base_family_size  IS 'Reference family size the ingredient quantities are written for; portion scaler diffs against user.family_size.';
COMMENT ON COLUMN recipes.spice_level       IS 'mild | medium | hot. Used for retrieval matching + re-rank against user.spice_preference.';
COMMENT ON COLUMN recipes.cooking_style     IS 'Cooking technique classification — drives retrieval semantic clustering.';
COMMENT ON COLUMN recipes.region_origin     IS 'Regional cuisine identity. Boosts ranking when user.preferred_region matches.';
COMMENT ON COLUMN recipes.heaviness         IS 'Meal weight: halka (light) | medium | bhaari (heavy). Drives seasonal/meal-slot recommendations.';
COMMENT ON COLUMN recipes.goes_well_with    IS 'Pairing hints surfaced in detail view and chatbot suggestions.';
COMMENT ON COLUMN recipes.vibes             IS 'Mood/occasion vibe slugs (VibeBadgeKey enum in TS types).';
COMMENT ON COLUMN recipes.thumbnail_source  IS 'Provenance of thumbnail: none | user | ai (Phase 2 AI-generated).';
COMMENT ON COLUMN recipes.cooked_count      IS 'Aggregate cook count — incremented on cooking_history insert; powers popularity ranking.';
COMMENT ON COLUMN recipes.embedding_text    IS 'Exact text used to generate `embedding`. Regenerate vectors by re-embedding this column.';
COMMENT ON COLUMN recipes.embedding         IS 'pgvector(1536) from text-embedding-3-small; used for cosine similarity recall.';
COMMENT ON COLUMN recipes.source            IS 'curated (seed) | user (Phase 2 submission) only. ''ai'' source is no longer used — AI recipes go to recipes_pending. Do NOT insert source=''ai'' rows into this table.';
COMMENT ON COLUMN recipes.like_count        IS 'User likes. Part of quality_score formula in lib/rag.ts re-rank.';
COMMENT ON COLUMN recipes.saved_count       IS 'User saves to personal list. Part of quality_score formula.';
COMMENT ON COLUMN recipes.reported_count    IS 'User reports (bad content, wrong recipe). Penalised 10× in quality_score — even 1 report suppresses ranking.';
COMMENT ON COLUMN recipes.reuse_count       IS 'How many times this recipe has been referenced from chat sessions. Signals conversational popularity.';

-- Vector index for pgvector cosine search.
-- lists = sqrt(N) for small corpora; bump as table grows beyond ~1000 rows.
CREATE INDEX recipes_embedding_idx
  ON recipes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- GIN indexes on JSONB columns
CREATE INDEX recipes_ingredients_gin ON recipes USING GIN (ingredients);
CREATE INDEX recipes_steps_gin       ON recipes USING GIN (steps);

-- GIN on array columns
CREATE INDEX recipes_tags_gin           ON recipes USING GIN (tags);
CREATE INDEX recipes_vibes_gin          ON recipes USING GIN (vibes);
CREATE INDEX recipes_meal_type_gin      ON recipes USING GIN (meal_type);
CREATE INDEX recipes_goes_well_with_gin ON recipes USING GIN (goes_well_with);

-- B-tree on commonly-filtered scalar columns
CREATE INDEX recipes_spice_level_idx    ON recipes (spice_level);
CREATE INDEX recipes_region_origin_idx  ON recipes (region_origin);
CREATE INDEX recipes_source_idx         ON recipes (source);
CREATE INDEX recipes_diet_type_idx      ON recipes (diet_type);
CREATE INDEX recipes_reported_count_idx ON recipes (reported_count);

-- ─────────────────────────────────────
-- COOKING HISTORY
-- ─────────────────────────────────────
CREATE TABLE cooking_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  recipe_id   UUID REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_at   TIMESTAMPTZ DEFAULT NOW(),
  family_size INTEGER
);

COMMENT ON COLUMN cooking_history.family_size IS 'Family size at the time of cooking — snapshot so later scaling/analytics stays accurate even if user.family_size changes.';

CREATE INDEX cooking_history_user_id_idx   ON cooking_history (user_id);
CREATE INDEX cooking_history_cooked_at_idx ON cooking_history (cooked_at DESC);

-- ─────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────
CREATE TABLE subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  razorpay_sub_id  VARCHAR(100) UNIQUE NOT NULL,
  plan             VARCHAR(50) DEFAULT 'monthly',
  amount_paise     INTEGER DEFAULT 15000,   -- ₹150
  status           VARCHAR(20),             -- 'active' | 'cancelled' | 'expired'
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN subscriptions.razorpay_sub_id IS 'Razorpay subscription identifier — unique; used to reconcile webhooks.';
COMMENT ON COLUMN subscriptions.plan            IS 'Plan code (currently only "monthly"); reserved for future tiers.';
COMMENT ON COLUMN subscriptions.amount_paise    IS 'Charge amount in paise (₹1 = 100 paise). 15000 = ₹150.';
COMMENT ON COLUMN subscriptions.status          IS 'Lifecycle: active | cancelled | expired. Source of truth = Razorpay webhook.';

-- ─────────────────────────────────────
-- KNOWLEDGE DOCS — atomic chunks
-- One intent / one kitchen problem per chunk.
-- Retrieved by the chatbot via RAG. Separate vector space from recipes.
-- See: scripts/seed/KB_WORKFLOW.md for chunking guidelines.
-- ─────────────────────────────────────
CREATE TABLE knowledge_docs (
  id                  VARCHAR(80) PRIMARY KEY,    -- human-readable slug, e.g. 'fix-namak-zyada-aloo'
  type                VARCHAR(50),                -- substitution | emergency_fix | seasonal | festival | tip | technique | glossary
  intent              VARCHAR(200),               -- short verb phrase: "reduce excess salt in gravy"
  problem             VARCHAR(200),               -- user-voice problem: "namak zyada ho gaya"
  applies_to          TEXT[] DEFAULT '{}',        -- ['dal','sabzi-gravy','sabzi-sukhi']
  ingredient_required VARCHAR(50),                -- single ingredient if any, e.g. 'aloo'
  topic               VARCHAR(200),               -- human-facing title (chatbot citation)
  tags                TEXT[] DEFAULT '{}',
  content             TEXT,                       -- 50-120 words, single intent
  preference_order    INTEGER DEFAULT 5,          -- 1 = primary; 9 = niche/last-resort
  embedding_text      TEXT,
  embedding           VECTOR(1536),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN knowledge_docs.id                  IS 'Stable human-readable slug. Seeds reference this; do not regenerate as UUID.';
COMMENT ON COLUMN knowledge_docs.type                IS 'Chunk kind. Drives UI affordances (emergency_fix gets faster response treatment).';
COMMENT ON COLUMN knowledge_docs.intent              IS 'Short verb phrase describing what this chunk does. Helps disambiguation in re-rank.';
COMMENT ON COLUMN knowledge_docs.problem             IS 'How users phrase the problem in Hinglish. Used as embedding signal + tag boost.';
COMMENT ON COLUMN knowledge_docs.applies_to          IS 'Recipe categories this fix is relevant for. SQL pre-filter narrows recall before vector.';
COMMENT ON COLUMN knowledge_docs.ingredient_required IS 'Single ingredient required (e.g. aloo for namak-fix). Null if no ingredient needed.';
COMMENT ON COLUMN knowledge_docs.preference_order    IS 'Tie-breaker rank when multiple chunks match a query. 1 = recommend first.';
COMMENT ON COLUMN knowledge_docs.embedding_text      IS 'Exact text used to generate `embedding`. Re-embed via this column on model upgrade.';

CREATE INDEX knowledge_docs_embedding_idx
  ON knowledge_docs USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 4);  -- ~sqrt(120); bump as corpus grows
CREATE INDEX knowledge_docs_tags_gin       ON knowledge_docs USING GIN (tags);
CREATE INDEX knowledge_docs_applies_to_gin ON knowledge_docs USING GIN (applies_to);
CREATE INDEX knowledge_docs_problem_idx    ON knowledge_docs (problem);
CREATE INDEX knowledge_docs_type_idx       ON knowledge_docs (type);

-- ─────────────────────────────────────
-- RECIPES PENDING — AI-generated staging area
-- One intent / one kitchen problem per chunk.
-- ─────────────────────────────────────
CREATE TABLE recipes_pending (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by          UUID REFERENCES users(id) ON DELETE CASCADE,
  ingredients_in        TEXT[] DEFAULT '{}',
  generated_recipe      JSONB NOT NULL,
  status                VARCHAR(20) DEFAULT 'pending',
  cooked_count          INTEGER DEFAULT 0,
  reported_count        INTEGER DEFAULT 0,
  shown_to_user_ids     UUID[] DEFAULT '{}',
  promoted_at           TIMESTAMPTZ,
  promoted_recipe_id    UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  recipes_pending                    IS 'AI-generated recipe staging area. Shown only to requesting user until promoted. Promotion gate: cooked_count >= 3 AND reported_count = 0, OR manual admin action. NEVER show to other users while status=pending.';
COMMENT ON COLUMN recipes_pending.requested_by       IS 'User who triggered CASE 2 fallback generation.';
COMMENT ON COLUMN recipes_pending.ingredients_in     IS 'Ingredient list that caused the RAG miss.';
COMMENT ON COLUMN recipes_pending.generated_recipe   IS 'Full recipe JSON from GPT-5-mini — not yet curated.';
COMMENT ON COLUMN recipes_pending.status             IS 'pending | promoted | rejected';
COMMENT ON COLUMN recipes_pending.cooked_count       IS 'How many unique users cooked this (via shown_to_user_ids).';
COMMENT ON COLUMN recipes_pending.reported_count     IS 'If > 0, auto-reject from promotion queue.';
COMMENT ON COLUMN recipes_pending.shown_to_user_ids  IS 'Prevents gaming cooked_count — one cook per user.';
COMMENT ON COLUMN recipes_pending.promoted_at        IS 'Set when status flips to promoted.';

CREATE INDEX recipes_pending_status_idx        ON recipes_pending (status);
CREATE INDEX recipes_pending_requested_by_idx  ON recipes_pending (requested_by);
CREATE INDEX recipes_pending_reported_count_idx ON recipes_pending (reported_count);

-- ─────────────────────────────────────
-- NOTE: No chat_sessions table.
-- Chat memory lives ONLY in Upstash Redis with TTL (3hr, refreshed per message).
-- Redis auto-expires keys — no cleanup cron, no duplicate storage in Postgres.
-- See: lib/memory.ts (to be implemented) and sysdesign-v2.md §Redis Architecture.
-- ─────────────────────────────────────

-- ─────────────────────────────────────
-- ROW LEVEL SECURITY (session-31 security audit)
-- The whole app accesses Postgres via the SERVICE ROLE key (createServerClient),
-- which bypasses RLS. The public anon key ships in the browser, so every table
-- it can touch must be locked down. Enabling RLS with NO policies denies all
-- anon/authenticated access while leaving the service role unaffected.
-- recipes + recipes_pending previously had RLS OFF *and* anon write grants —
-- anyone could TRUNCATE the recipe library via the public REST endpoint (P0).
-- ─────────────────────────────────────
ALTER TABLE recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes_pending  ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON recipes         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON recipes_pending FROM anon, authenticated;
-- Already ON (no policies, service-role-only): users, cooking_history,
-- subscriptions, recipe_ratings, recipe_saves, recipe_photos, push_subscriptions.
