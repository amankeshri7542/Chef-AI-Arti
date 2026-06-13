import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/recipes/browse — Simple SQL browse (NO embedding / vector search).
 * Used for default recipe grid on search page and collection browsing.
 * Much faster than /api/recipes/search (~50ms vs ~1-2s).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const sp = request.nextUrl.searchParams;

  const diet = sp.get('diet') ?? undefined;
  const vrat = sp.get('vrat') === 'true';
  const category = sp.get('category') ?? undefined;
  const tag = sp.get('tag') ?? undefined;
  const vibe = sp.get('vibe') ?? undefined;
  const limitParam = sp.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 24;

  const supabase = createServerClient();

  let query = supabase
    .from('recipes')
    .select(
      'id, name_hinglish, name_hindi, description, category, meal_type, diet_type, is_vrat_friendly, cook_time_minutes, prep_time_minutes, vibes, tags, thumbnail_url, avg_rating, rating_count, cooked_count, base_family_size, spice_level, heaviness, region_origin, ingredients, steps, soak_required, goes_well_with, cooking_style, excluded_items, embedding_text, source, nutrition, like_count, saved_count, reported_count, reuse_count, created_at, updated_at',
    )
    .eq('source', 'curated')
    .eq('reported_count', 0);

  if (diet) query = query.eq('diet_type', diet);
  if (vrat) query = query.eq('is_vrat_friendly', true);
  if (category) query = query.eq('category', category);
  if (tag) query = query.contains('tags', [tag]);
  if (vibe) query = query.contains('vibes', [vibe]);

  // If user is authenticated, filter by diet preference
  if (userId && !diet) {
    const { data: user } = await supabase
      .from('users')
      .select('diet_type')
      .eq('clerk_user_id', userId)
      .single<{ diet_type: string }>();

    if (user?.diet_type === 'veg') {
      query = query.eq('diet_type', 'veg');
    }
  }

  // Most saved within the filtered set first; cooked_count as tiebreak.
  query = query
    .order('saved_count', { ascending: false })
    .order('cooked_count', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[browse] error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipes: data ?? [] });
}
