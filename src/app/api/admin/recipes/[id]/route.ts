import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
import { buildRecipeEmbeddingText, type RecipeEmbedInput } from '../../_lib/embedding';

// GET — single recipe (edit form prefill)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json({ recipe: data });
}

// PUT — update; re-embed if content changed
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as RecipeEmbedInput | null;
  if (!body || !body.name_hinglish || !Array.isArray(body.ingredients)) {
    return NextResponse.json(
      { error: 'name_hinglish and ingredients are required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('recipes')
    .select('embedding_text')
    .eq('id', id)
    .single<{ embedding_text: string | null }>();

  if (!existing) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const embeddingText = buildRecipeEmbeddingText(body);
  const update: Record<string, unknown> = {
    name_hinglish: body.name_hinglish,
    name_hindi: body.name_hindi ?? null,
    description: body.description ?? null,
    category: body.category,
    diet_type: body.diet_type,
    is_vrat_friendly: body.is_vrat_friendly ?? false,
    ingredients: body.ingredients,
    steps: body.steps ?? [],
    cook_time_minutes: body.cook_time_minutes ?? 0,
    prep_time_minutes: body.prep_time_minutes ?? 0,
    soak_required: body.soak_required ?? false,
    base_family_size: body.base_family_size ?? 4,
    spice_level: body.spice_level,
    cooking_style: body.cooking_style,
    region_origin: body.region_origin,
    heaviness: body.heaviness,
    goes_well_with: body.goes_well_with ?? [],
    vibes: body.vibes ?? [],
    tags: body.tags ?? [],
    updated_at: new Date().toISOString(),
  };

  // Only re-embed when the semantic content actually changed.
  if (embeddingText !== existing.embedding_text) {
    update.embedding_text = embeddingText;
    update.embedding = await getEmbedding(embeddingText);
  }

  const { error } = await supabase.from('recipes').update(update).eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, reembedded: embeddingText !== existing.embedding_text });
}

// DELETE — remove recipe
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
