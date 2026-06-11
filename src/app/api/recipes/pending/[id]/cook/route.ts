import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateThumbnail, youtubeThumbnailUrl } from '@/lib/thumbnail';
import type { RecipePending } from '@/types/index';
import type { GeneratedRecipe } from '@/lib/generate-recipe';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 2. Resolve internal user UUID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single<{ id: string }>();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3. Fetch pending row
  const { data: row } = await supabase
    .from('recipes_pending')
    .select(
      'id, generated_recipe, status, cooked_count, reported_count, shown_to_user_ids, youtube_video_id, youtube_video_url, youtube_channel_name',
    )
    .eq('id', id)
    .single<
      Pick<
        RecipePending,
        | 'id'
        | 'generated_recipe'
        | 'status'
        | 'cooked_count'
        | 'reported_count'
        | 'shown_to_user_ids'
        | 'youtube_video_id'
        | 'youtube_video_url'
        | 'youtube_channel_name'
      >
    >();

  if (!row) {
    return NextResponse.json({ error: 'Recipe nahi mili' }, { status: 404 });
  }

  // Already promoted/rejected — nothing more to count.
  if (row.status !== 'pending') {
    return NextResponse.json({ alreadyCooked: true, promoted: false, cooksNeeded: 0 });
  }

  // ── COOK GUARD ───────────────────────────────────────────────
  // shown_to_user_ids is used as the "cooked-by" set. At creation the
  // requester is pre-seeded into it BUT cooked_count starts at 0.
  // So we cannot use "in array → reject" naively (that would block the
  // requester's own first cook). Deterministic rules:
  //   a) user NOT in set                 → add + increment.
  //   b) user IN set && cooked_count==0  → requester's seeded-but-uncounted
  //                                         first cook → increment, no re-add.
  //   c) user IN set && cooked_count>0   → already cooked → no-op.
  const ids = row.shown_to_user_ids ?? [];
  const inSet = ids.includes(user.id);

  if (inSet && row.cooked_count > 0) {
    // case (c)
    return NextResponse.json({
      alreadyCooked: true,
      promoted: false,
      cooksNeeded: Math.max(0, 3 - row.cooked_count),
    });
  }

  const newCookedCount = row.cooked_count + 1;
  const newShown = inSet ? ids : [...ids, user.id]; // (a) adds, (b) keeps

  // NOTE: We intentionally do NOT insert into cooking_history here.
  // cooking_history.recipe_id is a FK to recipes(id); a pending id is not a
  // real recipes row, so inserting would violate the FK. Cooking of pending
  // recipes is tracked purely via recipes_pending.cooked_count / shown_to_user_ids.

  // 6. Update pending row
  const { error: updErr } = await supabase
    .from('recipes_pending')
    .update({ cooked_count: newCookedCount, shown_to_user_ids: newShown })
    .eq('id', id);

  if (updErr) {
    return NextResponse.json({ error: 'Kuch gadbad ho gayi' }, { status: 500 });
  }

  // 7. Promotion check: 3+ cooks AND zero reports.
  if (newCookedCount >= 3 && row.reported_count === 0) {
    const gen = row.generated_recipe as Partial<GeneratedRecipe>;

    const { data: promoted, error: promoteErr } = await supabase
      .from('recipes')
      .insert({
        name_hinglish: gen.name_hinglish,
        description: gen.description ?? '',
        ingredients: gen.ingredients ?? [],
        steps: gen.steps ?? [],
        cook_time_minutes: gen.cook_time_minutes ?? 0,
        vibes: gen.vibes ?? [],
        tags: gen.tags ?? [],
        // Promoted recipes become real library entries. Schema forbids source='ai'
        // (TS RecipeSource = 'curated' | 'user'); 'curated' also makes them visible
        // to /surprise and the empty-state fallback, which filter source='curated'.
        source: 'curated',
        // YouTube video frame as instant placeholder; replaced by AI art below.
        thumbnail_url: row.youtube_video_id ? youtubeThumbnailUrl(row.youtube_video_id) : null,
        thumbnail_source: row.youtube_video_id ? 'youtube-temp' : 'none',
        category: 'sabzi', // safe default — generated recipes lack category
        diet_type: 'veg', // default
        youtube_video_id: row.youtube_video_id ?? null,
        youtube_video_url: row.youtube_video_url ?? null,
        youtube_channel_name: row.youtube_channel_name ?? null,
      })
      .select('id')
      .single<{ id: string }>();

    if (!promoteErr && promoted) {
      await supabase
        .from('recipes_pending')
        .update({ status: 'promoted', promoted_at: new Date().toISOString() })
        .eq('id', id);

      // Best-effort AI thumbnail — promotion already succeeded; failures
      // just leave the YouTube placeholder in place.
      try {
        const thumbnailUrl = await generateThumbnail(promoted.id, gen.name_hinglish ?? '');
        if (thumbnailUrl) {
          await supabase
            .from('recipes')
            .update({ thumbnail_url: thumbnailUrl, thumbnail_source: 'ai' })
            .eq('id', promoted.id);
        }
      } catch {
        console.error('[thumbnail] generation failed for', gen.name_hinglish);
      }

      return NextResponse.json({ promoted: true, recipeId: promoted.id });
    }
    // If promotion insert failed, fall through and just report progress.
  }

  return NextResponse.json({
    promoted: false,
    cooksNeeded: Math.max(0, 3 - newCookedCount),
  });
}
