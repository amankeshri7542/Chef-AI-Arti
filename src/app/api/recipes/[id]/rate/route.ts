import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karo pehle' }, { status: 401 });
  }

  const { id: recipeId } = await params;

  const body: { rating?: number } = await request.json();
  const rating = body.rating;

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'Rating 1 se 5 ke beech hona chahiye' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  // Get user's internal id
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  if (!userRow) {
    return NextResponse.json({ error: 'User nahi mila' }, { status: 404 });
  }

  const internalUserId = userRow.id;

  // Check cooking history — must have cooked the recipe
  const { data: history } = await supabase
    .from('cooking_history')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', internalUserId)
    .limit(1)
    .single();

  if (!history) {
    return NextResponse.json(
      { error: 'Pehle recipe banao, phir rating do! 🍳' },
      { status: 403 },
    );
  }

  // Upsert rating
  const { error: upsertError } = await supabase
    .from('recipe_ratings')
    .upsert(
      { recipe_id: recipeId, user_id: internalUserId, rating },
      { onConflict: 'recipe_id,user_id' },
    );

  if (upsertError) {
    console.error('[rate] upsert error:', upsertError.message);
    return NextResponse.json({ error: 'Rating save nahi hui' }, { status: 500 });
  }

  // Recalculate avg + count
  const { data: agg } = await supabase
    .from('recipe_ratings')
    .select('rating')
    .eq('recipe_id', recipeId);

  const ratings = (agg ?? []).map((r: { rating: number }) => r.rating);
  const newCount = ratings.length;
  const newAvg = newCount > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / newCount) * 100) / 100
    : 0;

  await supabase
    .from('recipes')
    .update({ avg_rating: newAvg, rating_count: newCount })
    .eq('id', recipeId);

  return NextResponse.json({
    success: true,
    avg_rating: newAvg,
    rating_count: newCount,
    user_rating: rating,
  });
}
