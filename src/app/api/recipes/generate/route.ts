import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
import { generateRecipeViaYouTube } from '@/lib/generate-recipe';
import { buildSegmentContext, makeSegmentKey } from '@/lib/personalization';
import type { SubscriptionStatus } from '@/types/index';

export async function POST(req: NextRequest) {
  // 1. Auth — Clerk string id
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 2. Resolve internal user (UUID + tier + segment fields)
  const { data: user } = await supabase
    .from('users')
    .select('id, subscription_status, family_size, diet_type, preferred_region, spice_preference')
    .eq('clerk_user_id', userId)
    .single<{
      id: string;
      subscription_status: SubscriptionStatus;
      family_size: number | null;
      diet_type: string | null;
      preferred_region: string | null;
      spice_preference: string | null;
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

  // Build segment key and context — used for both dedup and extraction prompt.
  const segmentKey = makeSegmentKey(user.diet_type ?? 'veg', user.preferred_region ?? null);
  const segmentContext = buildSegmentContext({
    diet_type: user.diet_type ?? 'veg',
    preferred_region: user.preferred_region ?? null,
    spice_preference: user.spice_preference ?? 'medium',
  });

  // 4a. Segment-aware dish-name dedup — "save once, serve many within a segment".
  // Matches on dish name AND segment_key so north-Indian-veg "Masala Dosa" and
  // south-Indian-veg "Masala Dosa" get separate, segment-appropriate generations.
  // Old rows (segment_key IS NULL) are never matched — they lack segment context.
  const dishName = query?.trim();
  if (dishName) {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dishMatch } = await supabase
      .from('recipes_pending')
      .select('id, generated_recipe, shown_to_user_ids')
      .ilike('generated_recipe->>name_hinglish', dishName)
      .eq('segment_key', segmentKey)
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
      console.log(`[generate] segment dedup hit: "${dishName}" (${segmentKey}) → ${dishMatch.id}`);
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

  // 6. Generate — YouTube transcript pipeline first, GPT fallback inside.
  // segmentContext threads through to both extractRecipeFromTranscript and
  // the GPT fallback in generateRecipe, making both paths segment-aware.
  let recipe;
  let video;
  try {
    ({ recipe, video } = await generateRecipeViaYouTube(ingredients, query, {
      familySize: user.family_size ?? 4,
      dietType: user.diet_type ?? 'veg',
      segmentContext: segmentContext || undefined,
    }));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, thodi der mein try karein' },
      { status: 500 },
    );
  }

  // 7. Persist to recipes_pending — write segment_key so future dedup queries
  //    can match same-segment requests without touching different-segment rows.
  const { data: inserted, error: insertErr } = await supabase
    .from('recipes_pending')
    .insert({
      requested_by: user.id,
      ingredients_in: ingredients,
      generated_recipe: recipe,
      status: 'pending',
      shown_to_user_ids: [user.id],
      segment_key: segmentKey,
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
