import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/thali/suggest — suggest 3 recipes for a full day (nashta/dopahar/raat)
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });

  const supabase = createServerClient();

  // Fetch user preferences
  const { data: user } = await supabase
    .from('users')
    .select('diet_type, family_size, is_vrat_mode')
    .eq('clerk_user_id', userId)
    .single<{ diet_type: string; family_size: number; is_vrat_mode: boolean }>();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Fetch recently cooked (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single<{ id: string }>();

  let recentIds: string[] = [];
  if (userRow) {
    const { data: recent } = await supabase
      .from('cooking_history')
      .select('recipe_id')
      .eq('user_id', userRow.id)
      .gte('cooked_at', sevenDaysAgo);
    recentIds = (recent ?? []).map((r: { recipe_id: string }) => r.recipe_id);
  }

  const mealSlots = [
    { key: 'nashta', label: 'Nashta', mealType: 'breakfast' },
    { key: 'dopahar', label: 'Dopahar', mealType: 'lunch' },
    { key: 'raat', label: 'Raat', mealType: 'dinner' },
  ] as const;

  const result: Record<string, unknown> = {};

  for (const slot of mealSlots) {
    let query = supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .contains('meal_type', [slot.mealType]);

    // Diet filter
    if (user.diet_type === 'veg') {
      query = query.eq('diet_type', 'veg');
    }

    // Vrat filter
    if (user.is_vrat_mode) {
      query = query.eq('is_vrat_friendly', true);
    }

    // Exclude recently cooked
    if (recentIds.length > 0) {
      query = query.not('id', 'in', `(${recentIds.join(',')})`);
    }

    query = query.order('cooked_count', { ascending: false }).limit(5);

    const { data: candidates } = await query;

    if (candidates && candidates.length > 0) {
      // Pick a random one from top 5 for variety
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      result[slot.key] = pick;
    } else {
      result[slot.key] = null;
    }
  }

  return NextResponse.json(result);
}
