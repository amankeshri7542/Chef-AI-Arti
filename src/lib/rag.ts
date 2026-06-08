/*
=== RUN THIS IN SUPABASE SQL EDITOR (match_recipes) ===

CREATE OR REPLACE FUNCTION match_recipes(
  query_embedding vector(1536),
  diet            text,
  vrat_mode       boolean,
  restrictions    text[],
  disliked        text[],
  match_count     int DEFAULT 10
)
RETURNS TABLE (
  id                 uuid,
  name_hinglish      text,
  name_hindi         text,
  description        text,
  category           text,
  meal_type          text[],
  diet_type          text,
  is_vrat_friendly   boolean,
  excluded_items     text[],
  ingredients        jsonb,
  steps              jsonb,
  cook_time_minutes  int,
  prep_time_minutes  int,
  soak_required      boolean,
  base_family_size   int,
  spice_level        text,
  cooking_style      text,
  region_origin      text,
  heaviness          text,
  goes_well_with     text[],
  vibes              text[],
  tags               text[],
  thumbnail_url      text,
  thumbnail_source   text,
  cooked_count       int,
  like_count         int,
  saved_count        int,
  reported_count     int,
  reuse_count        int,
  embedding_text     text,
  source             text,
  created_at         timestamptz,
  updated_at         timestamptz,
  similarity         float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name_hinglish,
    r.name_hindi,
    r.description,
    r.category,
    r.meal_type,
    r.diet_type,
    r.is_vrat_friendly,
    r.excluded_items,
    r.ingredients,
    r.steps,
    r.cook_time_minutes,
    r.prep_time_minutes,
    r.soak_required,
    r.base_family_size,
    r.spice_level,
    r.cooking_style,
    r.region_origin,
    r.heaviness,
    r.goes_well_with,
    r.vibes,
    r.tags,
    r.thumbnail_url,
    r.thumbnail_source,
    r.cooked_count,
    r.like_count,
    r.saved_count,
    r.reported_count,
    r.reuse_count,
    r.embedding_text,
    r.source,
    r.created_at,
    r.updated_at,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM recipes r
  WHERE
    r.diet_type = diet
    AND (vrat_mode = false OR r.is_vrat_friendly = true)
    AND (
      array_length(restrictions, 1) IS NULL
      OR NOT r.excluded_items && restrictions
    )
    AND (
      array_length(disliked, 1) IS NULL
      OR NOT (
        SELECT bool_or(ing->>'name' ILIKE ANY(disliked))
        FROM jsonb_array_elements(r.ingredients) AS ing
      )
    )
    AND r.reported_count = 0
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
*/

import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
import type { Recipe, User, Ingredient, RecipeStep, VibeBadgeKey,
              DietType, RecipeCategory, MealType, ThumbnailSource,
              SpiceLevel, CookingStyle, RegionOrigin, Heaviness, RecipeSource } from '@/types/index';

export interface RecipeSearchResult {
  recipes: Recipe[];
  isEmptyStateFallback: boolean;
  triggerCase2: boolean;
}

// Local type for RPC row — includes similarity, excludes the vector blob
type RpcRecipeRow = {
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
  prep_time_minutes: number;
  soak_required: boolean;
  base_family_size: number;
  spice_level: SpiceLevel;
  cooking_style: CookingStyle;
  region_origin: RegionOrigin;
  heaviness: Heaviness;
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
  avg_rating: number;
  rating_count: number;
  embedding_text: string | null;
  source: RecipeSource;
  created_at: string;
  updated_at: string;
  similarity: number;
};

function rowToRecipe(row: RpcRecipeRow): Recipe {
  return {
    ...row,
    avg_rating: row.avg_rating ?? 0,
    rating_count: row.rating_count ?? 0,
    embedding: null, // vector not fetched from RPC — not needed on client
  };
}

type UserContext = Pick<
  User,
  | 'diet_type'
  | 'is_vrat_mode'
  | 'restrictions'
  | 'family_size'
  | 'spice_preference'
  | 'preferred_region'
  | 'disliked_ingredients'
>;

/**
 * Full RAG pipeline for recipe search.
 * STEP 1 — guard   STEP 2 — embed   STEP 3 — RPC (SQL pre-filter + vector)
 * STEP 4 — re-rank  STEP 5 — empty state fallback
 */
export async function searchRecipes(
  query: string,
  user: UserContext,
  userId: string,
): Promise<RecipeSearchResult> {
  // STEP 1 — guard
  if (query.trim().length === 0) {
    return { recipes: [], isEmptyStateFallback: false, triggerCase2: false };
  }

  const supabase = createServerClient();

  // STEP 2 — embed
  const vector = await getEmbedding(query);

  // STEP 3 — SQL pre-filter + vector search via RPC
  const { data: rpcRows, error } = await supabase.rpc('match_recipes', {
    query_embedding: vector,
    diet: user.diet_type,
    vrat_mode: user.is_vrat_mode,
    restrictions: user.restrictions ?? [],
    disliked: user.disliked_ingredients ?? [],
    match_count: 10,
  });

  if (error) throw new Error(`match_recipes RPC failed: ${error.message}`);

  const rows = (rpcRows ?? []) as RpcRecipeRow[];

  if (rows.length === 0) {
    return await emptyStateFallback(supabase);
  }

  // STEP 4 — re-rank: similarity + personalization boosts + recency penalty
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: historyRows } = await supabase
    .from('cooking_history')
    .select('recipe_id')
    .eq('user_id', userId)
    .gte('cooked_at', sevenDaysAgo);

  const recentIds = new Set((historyRows ?? []).map((h: { recipe_id: string }) => h.recipe_id));

  const scored = rows.map((row) => {
    let score = row.similarity;

    if (user.preferred_region && row.region_origin === user.preferred_region) score += 0.1;
    if (row.spice_level === user.spice_preference) score += 0.05;
    if (recentIds.has(row.id)) score -= 0.2;

    const qualityBonus =
      (row.cooked_count * 3 + row.like_count * 2 + row.saved_count) / 100;
    score += qualityBonus;

    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3).map((s) => rowToRecipe(s.row));

  if (top3.length === 0) {
    return await emptyStateFallback(supabase);
  }

  return { recipes: top3, isEmptyStateFallback: false, triggerCase2: false };
}

async function emptyStateFallback(
  supabase: ReturnType<typeof createServerClient>,
): Promise<RecipeSearchResult> {
  const { data } = await supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .order('cooked_count', { ascending: false })
    .limit(5);

  return {
    recipes: (data ?? []) as Recipe[],
    isEmptyStateFallback: true,
    triggerCase2: true,
  };
}
