import OpenAI from 'openai';
import { CHAT_MODEL } from '@/lib/openai';
import type { Ingredient, RecipeStep, VibeBadgeKey } from '@/types/index';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Shape of a CASE 2 GPT-generated recipe. A loose subset of Recipe —
 * stored as-is in recipes_pending.generated_recipe (JSONB), and used to
 * build a full Recipe object at promotion time.
 */
export interface GeneratedRecipe {
  name_hinglish: string;
  description: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  cook_time_minutes: number;
  vibes: VibeBadgeKey[];
  tags: string[];
}

const SYSTEM_PROMPT = `You are Chef Arti, a North Indian home cooking expert.
Reply ONLY with valid JSON in this exact shape — no markdown, no prose:
{
  "name_hinglish": string,
  "description": string,
  "ingredients": [{"name": string, "qty_desi": string, "scale_type": "linear"|"salt"|"spice"|"oil"|"water"|"fixed"}],
  "steps": [{"step": number, "instruction": string, "time_minutes": number}],
  "cook_time_minutes": number,
  "vibes": string[],
  "tags": string[]
}
Rules: realistic ghar ka khana, no fancy/restaurant ingredients, no restaurant-style dishes.
Warm, respectful "aap" tone in Hinglish. description is one warm Hinglish sentence.`;

/**
 * Calls GPT to generate ONE homemade North-Indian recipe from the given
 * ingredients/query. Throws if the model output can't be parsed into the
 * required shape — callers should translate that into a retry message.
 */
export async function generateRecipe(
  ingredients: string[],
  query?: string,
): Promise<GeneratedRecipe> {
  const ingredientList = ingredients.join(', ');
  const userContent = query
    ? `Leftover/available ingredients: ${ingredientList}\nUser also asked: ${query}\nSuggest ONE realistic ghar ka khana dish.`
    : `User has these leftover ingredients: ${ingredientList}\nSuggest ONE realistic ghar ka khana dish.`;

  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = res.choices[0].message.content ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('generateRecipe: no JSON in model output');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedRecipe>;

  // Strict validation of the three load-bearing fields
  if (
    !parsed.name_hinglish ||
    !Array.isArray(parsed.ingredients) ||
    parsed.ingredients.length === 0 ||
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0
  ) {
    throw new Error('generateRecipe: missing required fields');
  }

  return {
    name_hinglish: parsed.name_hinglish,
    description: parsed.description ?? '',
    ingredients: parsed.ingredients as Ingredient[],
    steps: parsed.steps as RecipeStep[],
    cook_time_minutes: parsed.cook_time_minutes ?? 0,
    vibes: (parsed.vibes ?? []) as VibeBadgeKey[],
    tags: parsed.tags ?? [],
  };
}
