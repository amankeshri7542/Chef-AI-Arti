import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
import { generateRecipeViaYouTube } from '@/lib/generate-recipe';
import type { SubscriptionStatus } from '@/types/index';

export async function POST(req: NextRequest) {
  // 1. Auth — Clerk string id
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 2. Resolve internal user (UUID + tier)
  const { data: user } = await supabase
    .from('users')
    .select('id, subscription_status, family_size, diet_type')
    .eq('clerk_user_id', userId)
    .single<{
      id: string;
      subscription_status: SubscriptionStatus;
      family_size: number | null;
      diet_type: string | null;
    }>();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3. Parse + validate body
  let body: { ingredients?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Kuch ingredients bhejo' }, { status: 400 });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? (body.ingredients.filter((x) => typeof x === 'string') as string[])
    : [];
  const query = typeof body.query === 'string' ? body.query : undefined;

  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'Kuch ingredients bhejo' }, { status: 400 });
  }

  // 4a. Dish-name dedup BEFORE the per-user dedup — "save once, serve many".
  // If ANY user already generated this dish in the last 30 days, reuse it:
  // append this user to shown_to_user_ids and return the existing pending recipe.
  const dishName = query?.trim();
  if (dishName) {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dishMatch } = await supabase
      .from('recipes_pending')
      .select('id, generated_recipe, shown_to_user_ids')
      // Exact (case-insensitive) name match only. `%${dishName}%` was too
      // aggressive — "paneer" returned ANY paneer dish ever generated.
      .ilike('generated_recipe->>name_hinglish', dishName)
      .gte('created_at', cutoff30d)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        generated_recipe: unknown;
        shown_to_user_ids: string[] | null;
      }>();

    if (dishMatch) {
      const shownTo = dishMatch.shown_to_user_ids ?? [];
      if (!shownTo.includes(user.id)) {
        await supabase
          .from('recipes_pending')
          .update({ shown_to_user_ids: [...shownTo, user.id] })
          .eq('id', dishMatch.id);
      }
      console.log(`[yt-pipeline] dish-name dedup hit: "${dishName}" → ${dishMatch.id}`);
      return NextResponse.json({
        pendingId: dishMatch.id,
        recipe: dishMatch.generated_recipe,
        isGenerated: true,
      });
    }
  }

  // (Former step 4b — a blanket per-user 24h dedup — REMOVED. It returned the
  // user's most recent pending recipe for ANY new query, so every generation
  // after the first looked identical. The rate limit below now governs volume.)

  // 5. Rate limit (atomically increments — call exactly once)
  const allowed = await checkRateLimit(userId, 'ai-gen', user.subscription_status);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Aaj ki recipe generation limit ho gayi' },
      { status: 429 },
    );
  }

  // 6. Generate — YouTube transcript pipeline first, GPT fallback inside
  let recipe;
  let video;
  try {
    ({ recipe, video } = await generateRecipeViaYouTube(ingredients, query, {
      familySize: user.family_size ?? 4,
      dietType: user.diet_type ?? 'veg',
    }));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, thodi der mein try karein' },
      { status: 500 },
    );
  }

  // 7. Persist to recipes_pending (requester pre-seeded into shown_to_user_ids)
  const { data: inserted, error: insertErr } = await supabase
    .from('recipes_pending')
    .insert({
      requested_by: user.id,
      ingredients_in: ingredients,
      generated_recipe: recipe,
      status: 'pending',
      shown_to_user_ids: [user.id],
      youtube_video_id: video?.videoId ?? null,
      youtube_video_url: video?.url ?? null,
      youtube_channel_name: video?.channelName ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, thodi der mein try karein' },
      { status: 500 },
    );
  }

  // 8. Return
  return NextResponse.json({ pendingId: inserted.id, recipe, isGenerated: true });
}
