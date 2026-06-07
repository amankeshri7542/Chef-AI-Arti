import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Recipe } from '@/types/index';

export async function GET() {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  // 2. Get user diet_type + is_vrat_mode
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('diet_type, is_vrat_mode')
    .eq('clerk_user_id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3a. Get recipe IDs cooked in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: historyRows } = await supabase
    .from('cooking_history')
    .select('recipe_id')
    .eq('user_id', userId)
    .gte('cooked_at', sevenDaysAgo);

  const recentIds = (historyRows ?? []).map((h: { recipe_id: string }) => h.recipe_id);

  // 3b. Query recipes excluding recently cooked ones
  let query = supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .eq('diet_type', user.diet_type)
    .limit(10);

  if (user.is_vrat_mode) {
    query = query.eq('is_vrat_friendly', true);
  }

  if (recentIds.length > 0) {
    query = query.not('id', 'in', `(${recentIds.join(',')})`);
  }

  const { data: recipes } = await query;

  // 4. If no results, retry without the 7-day exclusion filter
  let pool: Recipe[] | null = recipes as Recipe[] | null;

  if (!pool || pool.length === 0) {
    let fallbackQuery = supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .eq('diet_type', user.diet_type)
      .limit(10);

    if (user.is_vrat_mode) {
      fallbackQuery = fallbackQuery.eq('is_vrat_friendly', true);
    }

    const { data: fallbackRecipes } = await fallbackQuery;
    pool = (fallbackRecipes ?? []) as Recipe[];
  }

  // 5. Still nothing → 404
  if (!pool || pool.length === 0) {
    return NextResponse.json({ error: 'Koi recipe nahi mili' }, { status: 404 });
  }

  // 6. Pick a random recipe from the pool
  const recipe = pool[Math.floor(Math.random() * pool.length)];

  return NextResponse.json({ recipe });
}
