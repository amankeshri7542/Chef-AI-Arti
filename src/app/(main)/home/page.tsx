import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import HomeClient from './HomeClient';
import { User, Recipe } from '@/types/index';

// Non-pan regions where we guarantee regional recipes in "Aaj ke liye".
// These match region_origin values in the recipes table.
const PAN_REGIONS = new Set(['pan-north-indian', 'UP', 'Bihar', 'Punjab', 'Haryana', 'Rajasthan', 'MP', 'Delhi-NCR', 'Jharkhand', 'Uttarakhand']);

export default async function HomePage() {
  const { userId } = await auth();

  const supabase = createServerClient();

  // Always fetch top 20 global recipes (public)
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .order('cooked_count', { ascending: false })
    .limit(20)
    .returns<Recipe[]>();

  // Fetch user only if logged in
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

    if (user) {
      const { count } = await supabase
        .from('cooking_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      cookedCount = count ?? 0;

      // Guarantee ≥1-2 regional recipes in "Aaj ke liye" for users whose
      // preferred_region is a non-pan specific cuisine (south-indian, bengali, etc.)
      const region = user.preferred_region;
      if (region && !PAN_REGIONS.has(region)) {
        const dietMatch =
          user.diet_type === 'eggetarian'
            ? ['veg', 'eggetarian']
            : user.diet_type === 'non-veg'
              ? ['veg', 'eggetarian', 'non-veg']
              : ['veg'];

        let q = supabase
          .from('recipes')
          .select('*')
          .eq('source', 'curated')
          .eq('region_origin', region)
          .in('diet_type', dietMatch);
        if (user.is_vrat_mode) q = q.eq('is_vrat_friendly', true);

        const { data: rr } = await q
          .order('cooked_count', { ascending: false })
          .limit(2)
          .returns<Recipe[]>();
        regionalRecipes = rr ?? [];
        if (regionalRecipes.length === 0) {
          console.log(`[home] no ${region} recipes for diet=${user.diet_type}`);
        }
      }
    }
  }

  return (
    <main>
      <HomeClient
        initialRecipes={(recipes ?? []) as Recipe[]}
        regionalRecipes={regionalRecipes}
        userName={user?.name ?? null}
        subscriptionStatus={user?.subscription_status ?? 'free'}
        initialIsVrat={user?.is_vrat_mode ?? false}
        isAuthenticated={!!userId}
        dietType={user?.diet_type ?? null}
        cookedCount={cookedCount}
      />
    </main>
  );
}
