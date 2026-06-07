// Chief-AI-Arti — shared TypeScript types. Mirrors Supabase schema (scripts/schema.sql).
// Update both in lockstep when schema changes.

// ─────────────────────────────────────
// Top-level enums (string literal unions)
// ─────────────────────────────────────

export type DietType = 'veg' | 'non-veg' | 'eggetarian';

export type UnitPreference = 'desi' | 'metric';

export type SubscriptionStatus = 'free' | 'paid';

export type ScaleType = 'linear' | 'salt' | 'spice' | 'oil' | 'water' | 'fixed';

export type RateLimitAction = 'chat' | 'scan' | 'recipes' | 'ai-gen';

export type RecipeCategory =
  | 'sabzi'
  | 'dal'
  | 'roti'
  | 'chawal'
  | 'nashta'
  | 'meetha';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ThumbnailSource = 'none' | 'user' | 'ai';

export type SpiceLevel = 'mild' | 'medium' | 'hot';

export type CookingStyle =
  | 'sukha'
  | 'tariwala'
  | 'bhuna'
  | 'dum'
  | 'tadka-based'
  | 'steamed'
  | 'fried'
  | 'roasted'
  | 'boiled';

export type RegionOrigin =
  | 'UP'
  | 'Bihar'
  | 'Jharkhand'
  | 'Delhi-NCR'
  | 'Punjab'
  | 'Haryana'
  | 'Rajasthan'
  | 'MP'
  | 'Bengal'
  | 'Uttarakhand'
  | 'pan-north-indian';

export type Heaviness = 'halka' | 'medium' | 'bhaari';

/** 'ai' removed — AI recipes now live in recipes_pending table */
export type RecipeSource = 'curated' | 'user';

export type QualityAction = 'like' | 'save' | 'report' | 'cook' | 'reuse';

export type PendingStatus = 'pending' | 'promoted' | 'rejected';

export type VibeBadgeKey =
  | 'halki-dish'
  | 'taakat-wali'
  | 'jaldi-bane'
  | 'bacchon-ki-fav'
  | 'tyohar-special'
  | 'teekha-alert'
  | 'vrat-wali'
  | 'comfort-food'
  | 'tiffin-ready'
  | 'monsoon-special'
  | 'sardi-warmth'
  | 'garmi-cool'
  | 'protein-rich'
  | 'one-pot'
  | 'leftover-friendly'
  | 'guest-special'
  | 'bujurg-friendly'
  | 'low-oil'
  | 'bina-pyaz-lehsun';

export type SubscriptionPlanStatus = 'active' | 'cancelled' | 'expired';

// ─────────────────────────────────────
// Knowledge-doc enums
// ─────────────────────────────────────

export type KnowledgeDocType =
  | 'substitution'
  | 'emergency_fix'
  | 'seasonal'
  | 'festival'
  | 'tip'
  | 'technique'
  | 'glossary';

// ─────────────────────────────────────
// Nested types
// ─────────────────────────────────────

export interface Ingredient {
  /** Semantic ingredient name only — no preparation. Used in embedding text. */
  name: string;
  /** Preparation form (cubed, chopped, sliced, paste). Display-only; not embedded. */
  prep?: string;
  qty_desi: string;
  qty_metric: string;
  scale_type: ScaleType;
}

export interface RecipeStep {
  step: number;
  instruction: string;
  time_minutes: number;
}

export interface VibeBadge {
  key: VibeBadgeKey;
  emoji: string;
  label_hinglish: string;
  description: string;
}

export interface IngredientChip {
  name: string;
  confidence: number;
  user_added?: boolean;
  removed?: boolean;
}

export interface CompressedMemory {
  current_recipe: string | null;
  family_size: number;
  cooking_progress: string;
  spice_preference?: SpiceLevel;
  oil_preference?: string;
  disliked_today?: string[];
  notes: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  compressed_memory: CompressedMemory;
  recent_messages: ChatMessage[];
}

// ─────────────────────────────────────
// Database row types
// ─────────────────────────────────────

export interface User {
  id: string;
  clerk_user_id: string;
  name: string | null;
  phone: string | null;
  diet_type: DietType;
  restrictions: string[];
  family_size: number;
  preferred_unit: UnitPreference;
  is_vrat_mode: boolean;
  subscription_status: SubscriptionStatus;
  subscription_ends_at: string | null;
  razorpay_sub_id: string | null;
  onboarding_done: boolean;
  /** mild | medium | hot — default 'medium'. Used by retrieval re-rank + prompt context. */
  spice_preference: SpiceLevel;
  /** Ingredient tokens the user dislikes (e.g. ['karela','baingan']). Filtered at SQL level. */
  disliked_ingredients: string[];
  /** Preferred regional cuisine for ranking boost. Null = no preference. */
  preferred_region: RegionOrigin | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  name_hinglish: string;
  name_hindi: string | null;
  description: string | null;
  category: RecipeCategory;
  meal_type: MealType[];
  diet_type: DietType;
  is_vrat_friendly: boolean;
  excluded_items: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
  cook_time_minutes: number;
  /** Soaking/chopping time before cooking starts. Separate from cook_time_minutes. */
  prep_time_minutes: number;
  /** True for rajma/chana/chole — requires overnight soak. UI surfaces this. */
  soak_required: boolean;
  base_family_size: number;
  spice_level: SpiceLevel;
  cooking_style: CookingStyle;
  region_origin: RegionOrigin;
  heaviness: Heaviness;
  /** Pairing hints — ['roti','jeera-rice','chaas']. */
  goes_well_with: string[];
  vibes: VibeBadgeKey[];
  tags: string[];
  thumbnail_url: string | null;
  thumbnail_source: ThumbnailSource;
  cooked_count: number;
  like_count: number;
  saved_count: number;
  reported_count: number;
  reuse_count: number;
  /**
   * Stored embedding input string — exact text used to generate `embedding`.
   * Regenerate `embedding` by re-embedding this column (model upgrades, schema changes).
   */
  embedding_text: string | null;
  embedding: number[] | null;
  /** Provenance — 'curated' seed, 'ai' generated, 'user' submitted. Default 'curated'. */
  source: RecipeSource;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDoc {
  id: string;
  type: KnowledgeDocType;
  /** Short verb-phrase describing what this chunk does. e.g. "reduce excess salt in gravy" */
  intent: string;
  /** Hinglish problem statement matching how users phrase it. e.g. "namak zyada ho gaya" */
  problem: string | null;
  /** Categories this fix applies to. e.g. ['dal','sabzi-gravy'] */
  applies_to: string[];
  /** Single ingredient required for this fix, if any. e.g. 'aloo' */
  ingredient_required: string | null;
  /** Human-facing title (citation in chatbot). */
  topic: string;
  tags: string[];
  content: string;
  /**
   * Lower = recommend first when multiple chunks match.
   * 1 = primary recommendation, 5 = default, 9 = niche/last-resort.
   */
  preference_order: number;
  embedding_text: string | null;
  embedding: number[] | null;
  created_at: string;
}

export interface CookingHistory {
  id: string;
  user_id: string;
  recipe_id: string;
  cooked_at: string;
  family_size: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  razorpay_sub_id: string;
  plan: string;
  amount_paise: number;
  status: SubscriptionPlanStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface RecipePending {
  id: string;
  requested_by: string;
  ingredients_in: string[];
  generated_recipe: Partial<Recipe>;
  status: PendingStatus;
  cooked_count: number;
  reported_count: number;
  shown_to_user_ids: string[];
  promoted_at: string | null;
  created_at: string;
}
