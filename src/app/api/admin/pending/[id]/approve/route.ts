import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
import { generateThumbnail, youtubeThumbnailUrl } from '@/lib/thumbnail';
import { buildRecipeEmbeddingText } from '../../../_lib/embedding';
import type { Recipe } from '@/types/index';

// POST — promote a pending AI recipe into the curated recipes table.
// Mirrors the promotion block in /api/recipes/pending/[id]/cook, but adds
// an embedding so the recipe is retrievable via RAG.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createServerClient();

  const { data: row } = await supabase
    .from('recipes_pending')
    .select('id, generated_recipe, status, youtube_video_id, youtube_video_url, youtube_channel_name')
    .eq('id', id)
    .single<{
      id: string;
      generated_recipe: Partial<Recipe>;
      status: string;
      youtube_video_id: string | null;
      youtube_video_url: string | null;
      youtube_channel_name: string | null;
    }>();

  if (!row) {
    return NextResponse.json({ error: 'Pending recipe not found' }, { status: 404 });
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: `Already ${row.status}` }, { status: 409 });
  }

  const gen = row.generated_recipe;
  if (!gen?.name_hinglish) {
    return NextResponse.json({ error: 'Generated recipe has no name' }, { status: 422 });
  }

  const recipeForEmbed = {
    name_hinglish: gen.name_hinglish,
    description: gen.description ?? '',
    ingredients: gen.ingredients ?? [],
    vibes: gen.vibes ?? [],
    tags: gen.tags ?? [],
    category: gen.category ?? 'sabzi',
    region_origin: gen.region_origin ?? 'pan-north-indian',
    goes_well_with: gen.goes_well_with ?? [],
  };
  const embeddingText = buildRecipeEmbeddingText(recipeForEmbed);
  const embedding = await getEmbedding(embeddingText);

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
      // Schema forbids source='ai'; 'curated' makes the recipe visible to
      // /surprise + empty-state fallback (both filter source='curated').
      source: 'curated',
      // YouTube frame as instant placeholder; replaced by AI art below.
      thumbnail_url: row.youtube_video_id ? youtubeThumbnailUrl(row.youtube_video_id) : null,
      thumbnail_source: row.youtube_video_id ? 'youtube-temp' : 'none',
      category: gen.category ?? 'sabzi', // safe default — generated recipes lack category
      diet_type: gen.diet_type ?? 'veg',
      youtube_video_id: row.youtube_video_id ?? null,
      youtube_video_url: row.youtube_video_url ?? null,
      youtube_channel_name: row.youtube_channel_name ?? null,
      embedding_text: embeddingText,
      embedding,
    })
    .select('id')
    .single<{ id: string }>();

  if (promoteErr || !promoted) {
    return NextResponse.json(
      { error: promoteErr?.message ?? 'Promotion insert failed' },
      { status: 500 },
    );
  }

  await supabase
    .from('recipes_pending')
    .update({ status: 'promoted', promoted_at: new Date().toISOString() })
    .eq('id', id);

  // Best-effort AI thumbnail — approval already succeeded; failure leaves
  // the YouTube placeholder (or emoji fallback) in place.
  const thumbnailUrl = await generateThumbnail(promoted.id, gen.name_hinglish);
  if (thumbnailUrl) {
    await supabase
      .from('recipes')
      .update({ thumbnail_url: thumbnailUrl, thumbnail_source: 'ai' })
      .eq('id', promoted.id);
  }

  return NextResponse.json({ success: true, recipeId: promoted.id });
}
