import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
import { buildRecipeEmbeddingText, type RecipeEmbedInput } from '../_lib/embedding';

// GET — list all recipes (admin table)
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name_hinglish, category, diet_type, region_origin, cooked_count, avg_rating, rating_count, thumbnail_url, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipes: data ?? [] });
}

// POST — create a recipe (with embedding, source 'curated')
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RecipeEmbedInput | null;
  if (!body || !body.name_hinglish || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return NextResponse.json(
      { error: 'name_hinglish and ingredients are required' },
      { status: 400 },
    );
  }

  const embeddingText = buildRecipeEmbeddingText(body);
  const embedding = await getEmbedding(embeddingText);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      name_hinglish: body.name_hinglish,
      name_hindi: body.name_hindi ?? null,
      description: body.description ?? null,
      category: body.category ?? 'sabzi',
      meal_type: body.meal_type ?? ['lunch', 'dinner'],
      diet_type: body.diet_type ?? 'veg',
      is_vrat_friendly: body.is_vrat_friendly ?? false,
      excluded_items: body.excluded_items ?? [],
      ingredients: body.ingredients,
      steps: body.steps ?? [],
      cook_time_minutes: body.cook_time_minutes ?? 0,
      prep_time_minutes: body.prep_time_minutes ?? 0,
      soak_required: body.soak_required ?? false,
      base_family_size: body.base_family_size ?? 4,
      spice_level: body.spice_level ?? 'medium',
      cooking_style: body.cooking_style ?? 'tariwala',
      region_origin: body.region_origin ?? 'pan-north-indian',
      heaviness: body.heaviness ?? 'medium',
      goes_well_with: body.goes_well_with ?? [],
      vibes: body.vibes ?? [],
      tags: body.tags ?? [],
      thumbnail_source: 'none',
      source: 'curated',
      embedding_text: embeddingText,
      embedding,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, success: true });
}
