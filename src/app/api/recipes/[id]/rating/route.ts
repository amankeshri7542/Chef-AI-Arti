import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ user_rating: null });
  }

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  if (!userRow) {
    return NextResponse.json({ user_rating: null });
  }

  const { data } = await supabase
    .from('recipe_ratings')
    .select('rating')
    .eq('recipe_id', recipeId)
    .eq('user_id', userRow.id)
    .single();

  return NextResponse.json({ user_rating: data?.rating ?? null });
}
