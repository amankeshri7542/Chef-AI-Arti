import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import DoneClient from './DoneClient';
import type { Recipe, RegionOrigin, User } from '@/types/index';

// Onboarding stores broad region buckets; recipes use granular region_origin.
// Map the bucket → the region_origin values we want to match against.
// Includes both old compound buckets (UP-Bihar) and new direct slugs (south-indian).
const REGION_MAP: Record<string, RegionOrigin[]> = {
  'UP-Bihar': ['UP', 'Bihar', 'Jharkhand'],
  'Delhi-NCR': ['Delhi-NCR'],
  'Punjab-Haryana': ['Punjab', 'Haryana'],
  'Rajasthan-MP': ['Rajasthan', 'MP'],
  // Direct onboarding slugs that match region_origin exactly
  'south-indian': ['south-indian'],
  'bengali': ['bengali', 'Bengal'],
  'gujarati': ['gujarati'],
  'maharashtrian': ['maharashtrian'],
  // Individual state slugs (newer onboarding)
  'UP': ['UP'],
  'Bihar': ['Bihar'],
  'Punjab': ['Punjab'],
  'Haryana': ['Haryana'],
  'Rajasthan': ['Rajasthan'],
  'MP': ['MP'],
};

export default async function OnboardingDonePage() {
  const { userId } = await auth();
  const supabase = createServerClient();

  // Fetch the user's preferences (best-effort)
  let diet: string | null = null;
  let region: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('diet_type, preferred_region')
      .eq('clerk_user_id', userId)
      .single<Pick<User, 'diet_type' | 'preferred_region'>>();
    diet = data?.diet_type ?? null;
    region = data?.preferred_region ?? null;
  }

  const regionOrigins = region ? (REGION_MAP[region] ?? null) : null;

  // Diet filter: veg users see veg only; non-veg/eggetarian users eat veg too.
  const dietMatch =
    diet === 'veg' ? ['veg'] : diet ? ['non-veg', 'eggetarian', 'veg'] : null;

  let recipes: Recipe[] = [];

  // Step 1 — GUARANTEED regional slot: up to 2 recipes from the user's region.
  // Separate query so region isn't drowned out by higher-cooked pan-north-indian rows.
  if (dietMatch && regionOrigins && regionOrigins.length > 0) {
    let q = supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .in('diet_type', dietMatch)
      .in('region_origin', regionOrigins);
    const { data } = await q
      .order('cooked_count', { ascending: false })
      .limit(2)
      .returns<Recipe[]>();
    recipes = data ?? [];
    if (recipes.length === 0) {
      console.log(`[onboarding/done] no ${region} recipes for diet=${diet} — using pan fallback`);
    }
  }

  // Step 2 — Fill remaining slots from pan-north-indian (diet filtered, dedup).
  const seenIds = new Set(recipes.map((r) => r.id));
  if (recipes.length < 3) {
    let fb = supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .eq('region_origin', 'pan-north-indian');
    if (dietMatch) fb = fb.in('diet_type', dietMatch);
    const { data } = await fb
      .order('cooked_count', { ascending: false })
      .limit(3)
      .returns<Recipe[]>();
    for (const r of data ?? []) {
      if (!seenIds.has(r.id) && recipes.length < 3) {
        recipes.push(r);
        seenIds.add(r.id);
      }
    }
  }

  // Step 3 — Fallback: any curated top 3 if still short (e.g. no diet set).
  if (recipes.length === 0) {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .order('cooked_count', { ascending: false })
      .limit(3)
      .returns<Recipe[]>();
    recipes = data ?? [];
  }

  return <DoneClient recipes={recipes} />;
}
