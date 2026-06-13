import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import HomeClient from './HomeClient';
import { User, Recipe } from '@/types/index';

// Non-pan regions where we guarantee regional recipes in "Aaj ke liye".
// These match region_origin values in the recipes table.
const PAN_REGIONS = new Set(['pan-north-indian', 'UP', 'Bihar', 'Punjab', 'Haryana', 'Rajasthan', 'MP', 'Delhi-NCR', 'Jharkhand', 'Uttarakhand']);

// Map diet_type to the set of diet_type values that user can eat.
function dietAllowList(dietType: string | null | undefined): string[] {
  if (dietType === 'eggetarian') return ['veg', 'eggetarian'];
  if (dietType === 'non-veg') return ['veg', 'eggetarian', 'non-veg'];
  // veg / vegan / jain / null (guest) → show only veg
  return ['veg'];
}

export default async function HomePage() {
  const { userId } = await auth();

  const supabase = createServerClient();

  // Fetch user first (needed to filter global pool by diet).
  let user: User | null = null;
  let cookedCount = 0;
  let regionalRecipes: Recipe[] = [];

  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single<User>();
    user = data;

    // Clerk session exists but no Supabase row — sync-redirect was missed
    // (e.g. middleware returned 401 before the route ran). Re-run it now.
    if (!user) {
      console.log('[home] clerk user has no DB row, re-running sync:', userId);
      redirect('/api/users/sync-redirect');
    }
  }

  // Build diet allow-list so the global pool is already diet-correct.
  const allowed = dietAllowList(user?.diet_type);

  // Fetch top 30 diet-filtered curated recipes.
  // Over-fetch (30 not 20) so spice-sort in HomeClient still leaves 20 options
  // after any vrat filter is applied client-side.
  // For pan sub-region users (UP, Punjab, etc.) also pull their region first so
  // sub-regional dishes surface even if they haven't been saved/cooked yet.
  const region = user?.preferred_region ?? null;
  const isPanSubRegion = region && PAN_REGIONS.has(region) && region !== 'pan-north-indian';

  let globalQuery = supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .in('diet_type', allowed);

  // For pan sub-regions (UP, Punjab, Bihar…), prioritise their region + pan.
  // For south-indian/bengali/etc., the separate regionalRecipes fetch below handles it.
  if (isPanSubRegion) {
    globalQuery = globalQuery.in('region_origin', [region!, 'pan-north-indian']);
  }

  const { data: recipesRaw } = await globalQuery
    .order('saved_count', { ascending: false })
    .order('cooked_count', { ascending: false })
    .limit(30)
    .returns<Recipe[]>();

  const recipes: Recipe[] = recipesRaw ?? [];

  // If we got < 10 results (e.g. very specific region with few recipes), fill
  // from pan-north-indian so the carousel never looks empty.
  let recipesOut = recipes;
  if (isPanSubRegion && recipes.length < 10) {
    const { data: fill } = await supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .in('diet_type', allowed)
      .eq('region_origin', 'pan-north-indian')
      .not('id', 'in', `(${recipes.map((r) => r.id).join(',')})`)
      .order('saved_count', { ascending: false })
      .limit(30 - recipes.length)
      .returns<Recipe[]>();
    recipesOut = [...recipes, ...(fill ?? [])];
  }

  if (userId && user) {
    const { count } = await supabase
      .from('cooking_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    cookedCount = count ?? 0;

    // For non-pan specific cuisines (south-indian, bengali, gujarati, maharashtrian),
    // guarantee up to 4 regional recipes so they always lead "Aaj ke liye".
    if (region && !PAN_REGIONS.has(region)) {
      const dietMatch = dietAllowList(user.diet_type);
      let q = supabase
        .from('recipes')
        .select('*')
        .eq('source', 'curated')
        .eq('region_origin', region)
        .in('diet_type', dietMatch);
      if (user.is_vrat_mode) q = q.eq('is_vrat_friendly', true);

      const { data: rr } = await q
        .order('cooked_count', { ascending: false })
        .limit(4)
        .returns<Recipe[]>();
      regionalRecipes = rr ?? [];
      if (regionalRecipes.length === 0) {
        console.log(`[home] no ${region} recipes for diet=${user.diet_type}`);
      }
    }
  }

  return (
    <main>
      <HomeClient
        initialRecipes={recipesOut}
        regionalRecipes={regionalRecipes}
        userName={user?.name ?? null}
        subscriptionStatus={user?.subscription_status ?? 'free'}
        initialIsVrat={user?.is_vrat_mode ?? false}
        isAuthenticated={!!userId}
        dietType={user?.diet_type ?? null}
        spicePreference={user?.spice_preference ?? null}
        cookedCount={cookedCount}
      />
    </main>
  );
}
