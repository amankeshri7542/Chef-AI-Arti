import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { buildHinglishQuery } from '@/lib/ingredient-map';
import { generateRecipeViaYouTube } from '@/lib/generate-recipe';
import { checkRateLimit, RATE_LIMITS } from '@/lib/redis';
import { buildPersonalizationContext, buildSegmentContext, makeSegmentKey } from '@/lib/personalization';
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
> &
  Partial<Pick<User, 'time_preference' | 'cooking_skill' | 'kitchen_setup'>>;

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
      'id, diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients, time_preference, cooking_skill, kitchen_setup, subscription_status',
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
    time_preference: (user as UserCtx).time_preference,
    cooking_skill: (user as UserCtx).cooking_skill,
    kitchen_setup: (user as UserCtx).kitchen_setup,
  };

  // 5 — retrieval-first
  // Build segment key + context for CASE 2. CASE 1 is already personalized
  // through userCtx soft boosts (region/spice re-rank) in rag.ts.
  const segmentKey = makeSegmentKey(userCtx.diet_type ?? 'veg', userCtx.preferred_region ?? null);
  const segmentContext = buildSegmentContext({
    diet_type: userCtx.diet_type ?? 'veg',
    preferred_region: userCtx.preferred_region ?? null,
    spice_preference: userCtx.spice_preference ?? 'medium',
  });

  // Keep _personCtx for any future use (chat/message already uses it separately).
  const _personCtx = buildPersonalizationContext({
    diet_type: userCtx.diet_type,
    spice_preference: userCtx.spice_preference,
    preferred_region: userCtx.preferred_region ?? null,
    cooking_skill: (userCtx.cooking_skill ?? 'intermediate') as User['cooking_skill'],
    time_preference: (userCtx.time_preference ?? 'any') as User['time_preference'],
    kitchen_setup: userCtx.kitchen_setup ?? [],
    is_vrat_mode: userCtx.is_vrat_mode,
    cooking_for: 'family' as User['cooking_for'],
    family_size: userCtx.family_size ?? 4,
  });

  // Regional hint for YouTube search query — surfaces region-appropriate videos.
  const regionHint =
    userCtx.preferred_region && !['pan-north-indian', null].includes(userCtx.preferred_region)
      ? userCtx.preferred_region
      : '';

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

  // 7 — CASE 2: generate a fresh recipe (YouTube pipeline → GPT fallback).
  // Consumes the same daily 'ai-gen' bucket as /api/recipes/generate so this
  // route can't be used to bypass the generation rate limit.
  const genAllowed = await checkRateLimit(userId, 'ai-gen', 'paid');
  if (!genAllowed) {
    return NextResponse.json(
      { error: `Aaj ke ${RATE_LIMITS.paid['ai-gen']} naye recipes ban gaye! Kal phir try karein 😊` },
      { status: 429 },
    );
  }

  try {
    // Enrich the query with region hint so YouTube search surfaces regional videos.
    const enrichedQuery = [query, regionHint].filter(Boolean).join(' ');
    const { recipe: generated, video } = await generateRecipeViaYouTube(
      ingredients,
      enrichedQuery,
      {
        familySize: userCtx.family_size ?? 4,
        dietType: userCtx.diet_type ?? 'veg',
        segmentContext: segmentContext || undefined,
      },
    );

    const { data: inserted, error: insertErr } = await supabase
      .from('recipes_pending')
      .insert({
        requested_by: (user as { id: string }).id,
        ingredients_in: ingredients,
        generated_recipe: generated,
        status: 'pending',
        shown_to_user_ids: [(user as { id: string }).id],
        segment_key: segmentKey,
        youtube_video_id: video?.videoId ?? null,
        youtube_video_url: video?.url ?? null,
        youtube_channel_name: video?.channelName ?? null,
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
