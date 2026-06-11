// Admin-side replica of scripts/seed-recipes.ts buildRecipeEmbeddingText.
// Keep in lockstep — labeled segments improve text-embedding-3-small clustering.

import type { Ingredient, Recipe } from '@/types/index';

export type RecipeEmbedInput = Partial<Recipe> & {
  name_hinglish: string;
  ingredients: Ingredient[];
};

export function buildRecipeEmbeddingText(r: RecipeEmbedInput): string {
  const ingredients = r.ingredients ?? [];
  const mainIngredients = ingredients
    .filter((i) => i.scale_type === 'linear')
    .map((i) => i.name);
  const spices = ingredients
    .filter((i) => i.scale_type === 'spice')
    .map((i) => i.name);

  const segments: string[] = [
    `Name: ${r.name_hinglish}`,
    `Region: ${r.region_origin ?? 'pan-north-indian'}`,
    `Category: ${r.category ?? 'sabzi'} | Style: ${r.cooking_style ?? 'tariwala'} | Spice: ${r.spice_level ?? 'medium'} | Weight: ${r.heaviness ?? 'medium'}`,
    `Vibes: ${(r.vibes ?? []).join(', ') || 'none'}`,
  ];

  if ((r.goes_well_with ?? []).length > 0) {
    segments.push(`Goes well with: ${(r.goes_well_with ?? []).join(', ')}`);
  }

  if (r.description) {
    segments.push(`Description: ${r.description}`);
  }

  if (mainIngredients.length > 0) {
    segments.push(`Main ingredients: ${mainIngredients.join(', ')}`);
  }

  if (spices.length > 0) {
    segments.push(`Spices used: ${spices.join(', ')}`);
  }

  if ((r.tags ?? []).length > 0) {
    segments.push(`Tags: ${(r.tags ?? []).join(', ')}`);
  }

  if (r.is_vrat_friendly) {
    segments.push(`Vrat-friendly: yes (no onion, no garlic, saatvik)`);
  }

  return segments.join('\n');
}
