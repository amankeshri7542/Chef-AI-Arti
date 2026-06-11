import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
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
    .select('id, generated_recipe, status')
    .eq('id', id)
    .single<{ id: string; generated_recipe: Partial<Recipe>; status: string }>();

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
      thumbnail_source: 'none',
      category: gen.category ?? 'sabzi', // safe default — generated recipes lack category
      diet_type: gen.diet_type ?? 'veg',
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

  return NextResponse.json({ success: true, recipeId: promoted.id });
}
