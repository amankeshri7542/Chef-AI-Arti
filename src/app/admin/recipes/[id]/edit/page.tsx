import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import type { Recipe } from '@/types/index';
import RecipeForm, { type RecipeFormValues } from '../../RecipeForm';

export const dynamic = 'force-dynamic';

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = createServerClient();
  const { data: recipe } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single<Recipe>();

  if (!recipe) notFound();

  const initial: Partial<RecipeFormValues> = {
    name_hinglish: recipe.name_hinglish,
    name_hindi: recipe.name_hindi ?? '',
    description: recipe.description ?? '',
    category: recipe.category,
    diet_type: recipe.diet_type,
    region_origin: recipe.region_origin,
    spice_level: recipe.spice_level,
    heaviness: recipe.heaviness,
    cooking_style: recipe.cooking_style,
    cook_time_minutes: recipe.cook_time_minutes,
    prep_time_minutes: recipe.prep_time_minutes,
    base_family_size: recipe.base_family_size,
    is_vrat_friendly: recipe.is_vrat_friendly,
    ingredients: (recipe.ingredients ?? []).map((i) => ({
      name: i.name,
      qty_desi: i.qty_desi,
      qty_metric: i.qty_metric,
      scale_type: i.scale_type,
    })),
    steps: (recipe.steps ?? []).map((s) => ({
      instruction: s.instruction,
      time_minutes: s.time_minutes,
    })),
    tags: (recipe.tags ?? []).join(', '),
    vibes: recipe.vibes ?? [],
  };

  return <RecipeForm recipeId={id} initial={initial} />;
}
