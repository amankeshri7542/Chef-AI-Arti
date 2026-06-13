import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Recipe, DietType } from '@/types/index';

// Regions where a soft vector boost is sufficient; these have large recipe counts.
const PAN_REGIONS = new Set([
  'pan-north-indian', 'UP', 'Bihar', 'Punjab', 'Haryana',
  'Rajasthan', 'MP', 'Delhi-NCR', 'Jharkhand', 'Uttarakhand',
]);

/**
 * "Because you cooked..." recommendations.
 * Cheap SQL only — no embeddings, no GPT, no rate limit.
 *
 * GET /api/recipes/recommendations?recipeId=<uuid>
 * - Guests / no history → single popular group ("Sabse zyada banaye gaye").
 * - Else → up to 3 groups, one per recently-cooked recipe, each with up to 3
 *   similar curated recipes (same category OR region OR spice level).
 */

export interface RecommendationGroup {
  reason: string;
  based_on_recipe: string;
  recipes: Recipe[];
}

type SupabaseServer = ReturnType<typeof createServerClient>;

interface CookedRecipeInfo {
  id: string;
  name_hinglish: string;
  category: string;
  region_origin: string;
  spice_level: string;
}

interface HistoryRow {
  recipe_id: string;
  cooked_at: string;
  recipes: CookedRecipeInfo | CookedRecipeInfo[] | null;
}

function applyDietFilter<
  T extends { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T },
>(q: T, dietType: DietType | null): T {
  // veg/vegan/jain → veg only (vegan/jain treated as veg for now);
  // eggetarian → veg + eggetarian; non-veg → everything.
  if (dietType === 'eggetarian') return q.in('diet_type', ['veg', 'eggetarian']);
  if (dietType === 'non-veg' || dietType === null) return q;
  return q.eq('diet_type', 'veg');
}

async function popularGroup(
  supabase: SupabaseServer,
  dietType: DietType | null,
): Promise<RecommendationGroup> {
  let q = supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .eq('reported_count', 0);
  q = applyDietFilter(q, dietType);
  const { data } = await q.order('cooked_count', { ascending: false }).limit(10);

  return {
    reason: 'Sabse zyada banaye gaye',
    based_on_recipe: '',
    recipes: (data ?? []) as Recipe[],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const biasRecipeId = request.nextUrl.searchParams.get('recipeId');
    const supabase = createServerClient();

    // ── Guests → popular group only ──────────────────────────────────────────
    if (!userId) {
      return NextResponse.json({ groups: [await popularGroup(supabase, null)] });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, diet_type, is_vrat_mode, preferred_region')
      .eq('clerk_user_id', userId)
      .single<{ id: string; diet_type: DietType; is_vrat_mode: boolean; preferred_region: string | null }>();

    if (!user) {
      return NextResponse.json({ groups: [await popularGroup(supabase, null)] });
    }

    // ── Last 10 cooks joined to recipe basics ────────────────────────────────
    const { data: history } = await supabase
      .from('cooking_history')
      .select(
        'recipe_id, cooked_at, recipes(id, name_hinglish, category, region_origin, spice_level)',
      )
      .eq('user_id', user.id)
      .order('cooked_at', { ascending: false })
      .limit(10)
      .returns<HistoryRow[]>();

    const rows = history ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ groups: [await popularGroup(supabase, user.diet_type)] });
    }

    // Last 3 DISTINCT cooked recipes (most recent first)
    const recentIds: string[] = [];
    const baseRecipes: CookedRecipeInfo[] = [];
    for (const row of rows) {
      if (!recentIds.includes(row.recipe_id)) recentIds.push(row.recipe_id);
      const rec = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
      if (rec && baseRecipes.length < 3 && !baseRecipes.some((b) => b.id === rec.id)) {
        baseRecipes.push(rec);
      }
    }

    if (baseRecipes.length === 0) {
      return NextResponse.json({ groups: [await popularGroup(supabase, user.diet_type)] });
    }

    const excludeList = `(${recentIds.join(',')})`;

    // ── Similar recipes per base recipe ──────────────────────────────────────
    const results = await Promise.all(
      baseRecipes.map(async (base) => {
        let q = supabase
          .from('recipes')
          .select('*')
          .eq('source', 'curated')
          .eq('reported_count', 0)
          .not('id', 'in', excludeList)
          .or(
            `category.eq.${base.category},region_origin.eq.${base.region_origin},spice_level.eq.${base.spice_level}`,
          );
        q = applyDietFilter(q, user.diet_type);
        if (user.is_vrat_mode) q = q.eq('is_vrat_friendly', true);

        // Over-fetch a bit so cross-group dedup still leaves up to 3 per group
        const { data } = await q.order('cooked_count', { ascending: false }).limit(9);
        return { base, similar: (data ?? []) as Recipe[] };
      }),
    );

    // ── Build groups, dedup across groups (recipe stays in its FIRST group) ──
    const seen = new Set<string>();
    let groups: (RecommendationGroup & { base_id: string })[] = [];

    for (const { base, similar } of results) {
      const picked: Recipe[] = [];
      for (const r of similar) {
        if (seen.has(r.id) || picked.length >= 3) continue;
        seen.add(r.id);
        picked.push(r);
      }
      if (picked.length > 0) {
        groups.push({
          reason: `${base.name_hinglish} banaya tha, toh yeh try karein`,
          based_on_recipe: base.name_hinglish,
          recipes: picked,
          base_id: base.id,
        });
      }
    }

    // If recipeId given (post-cook), put that recipe's group first
    if (biasRecipeId) {
      groups = [
        ...groups.filter((g) => g.base_id === biasRecipeId),
        ...groups.filter((g) => g.base_id !== biasRecipeId),
      ];
    }

    // ── Regional guarantee group ──────────────────────────────────────────────
    // For users with a specific non-pan preferred_region (e.g. south-indian),
    // check if their region is already represented in the existing groups.
    // If not, append a "Aapke region ke recipes" group so they always see
    // at least some regional content, even if they've never cooked those dishes.
    const preferredRegion = user.preferred_region;
    if (preferredRegion && !PAN_REGIONS.has(preferredRegion)) {
      const alreadyCovered = groups.some((g) =>
        g.recipes.some((r) => r.region_origin === preferredRegion),
      );
      if (!alreadyCovered) {
        let rq = supabase
          .from('recipes')
          .select('*')
          .eq('source', 'curated')
          .eq('reported_count', 0)
          .eq('region_origin', preferredRegion);
        rq = applyDietFilter(rq, user.diet_type);
        if (user.is_vrat_mode) rq = rq.eq('is_vrat_friendly', true);
        const { data: rdata } = await rq
          .order('cooked_count', { ascending: false })
          .limit(3);
        const regionalPicked = ((rdata ?? []) as Recipe[]).filter(
          (r) => !seen.has(r.id),
        );
        if (regionalPicked.length > 0) {
          groups.push({
            reason: 'Aapke region ke khaas recipes',
            based_on_recipe: '',
            base_id: '',
            recipes: regionalPicked,
          });
        } else {
          console.log(`[recommendations] no ${preferredRegion} recipes for diet=${user.diet_type}`);
        }
      }
    }

    return NextResponse.json({
      groups: groups.map(({ reason, based_on_recipe, recipes }) => ({
        reason,
        based_on_recipe,
        recipes,
      })),
    });
  } catch (err) {
    console.error('[recommendations] error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ groups: [] });
  }
}
