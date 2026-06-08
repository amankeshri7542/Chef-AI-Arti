import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { buildHinglishQuery } from '@/lib/ingredient-map';
import { generateRecipe } from '@/lib/generate-recipe';
import type { User } from '@/types/index';

type UserCtx = Pick<
  User,
  | 'diet_type'
  | 'is_vrat_mode'
  | 'restrictions'
  | 'family_size'
  | 'spice_preference'
  | 'preferred_region'
  | 'disliked_ingredients'
>;

export async function POST(request: NextRequest) {
  // 1 — auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 2 — look up user (need internal UUID id + preferences + subscription)
  const { data: user } = await supabase
    .from('users')
    .select(
      'id, diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients, subscription_status',
    )
    .eq('clerk_user_id', userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User nahi mila' }, { status: 404 });
  }

  // 3 — paid gate
  if ((user as { subscription_status?: string }).subscription_status !== 'paid') {
    return NextResponse.json(
      { error: 'Yeh feature premium mein hai 🌟' },
      { status: 403 },
    );
  }

  // 4 — parse + validate body
  let ingredients: string[];
  try {
    const body = (await request.json()) as { ingredients?: unknown };
    ingredients = Array.isArray(body.ingredients)
      ? body.ingredients
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  } catch {
    ingredients = [];
  }

  if (ingredients.length < 1 || ingredients.length > 5) {
    return NextResponse.json(
      { error: 'Ek se paanch cheezein chuno' },
      { status: 400 },
    );
  }

  const userCtx: UserCtx = {
    diet_type: (user as UserCtx).diet_type,
    is_vrat_mode: (user as UserCtx).is_vrat_mode,
    restrictions: (user as UserCtx).restrictions,
    family_size: (user as UserCtx).family_size,
    spice_preference: (user as UserCtx).spice_preference,
    preferred_region: (user as UserCtx).preferred_region,
    disliked_ingredients: (user as UserCtx).disliked_ingredients,
  };

  // 5 — retrieval-first
  const query = buildHinglishQuery(ingredients);

  let result;
  try {
    result = await searchRecipes(query, userCtx, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bacha-hua] searchRecipes error:', msg);
    result = { recipes: [], isEmptyStateFallback: true, triggerCase2: true };
  }

  // 6 — CASE 1: real curated match
  if (
    result.recipes.length > 0 &&
    !result.triggerCase2 &&
    !result.isEmptyStateFallback
  ) {
    return NextResponse.json({ recipes: result.recipes });
  }

  // 7 — CASE 2: generate a fresh recipe
  try {
    const generated = await generateRecipe(ingredients);

    const { data: inserted, error: insertErr } = await supabase
      .from('recipes_pending')
      .insert({
        requested_by: (user as { id: string }).id,
        ingredients_in: ingredients,
        generated_recipe: generated,
        status: 'pending',
        shown_to_user_ids: [(user as { id: string }).id],
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw new Error(insertErr?.message ?? 'recipes_pending insert failed');
    }

    return NextResponse.json({
      recipes: [],
      generated: {
        pendingId: (inserted as { id: string }).id,
        recipe: generated,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bacha-hua] generateRecipe error:', msg);
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, dobara try karein' },
      { status: 500 },
    );
  }
}
