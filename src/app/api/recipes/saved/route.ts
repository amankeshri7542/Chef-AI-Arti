import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Recipe } from '@/types/index';

/**
 * GET /api/recipes/saved — returns saved recipes for the authenticated user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });

  const supabase = createServerClient();

  // Join recipe_saves with recipes
  const { data, error } = await supabase
    .from('recipe_saves')
    .select('recipe_id, created_at, recipes(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[saved] error:', error.message);
    return NextResponse.json({ recipes: [] });
  }

  // Extract the recipe objects, filter nulls
  const recipes = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes as Recipe)
    .filter(Boolean);

  return NextResponse.json({ recipes });
}
