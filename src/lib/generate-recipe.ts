import OpenAI from 'openai';
import { CHAT_MODEL } from '@/lib/openai';
import {
  searchYouTubeRecipe,
  extractTranscript,
  type YouTubeVideo,
} from '@/lib/youtube';
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
  const recipe = parseAndValidateRecipe(raw);
  if (!recipe) throw new Error('generateRecipe: invalid model output');
  return recipe;
}

/**
 * Shared parse + validation for model recipe output. Returns null instead of
 * throwing so transcript-based extraction can fall back gracefully.
 * Strictly validates the three load-bearing fields (name/ingredients/steps).
 */
function parseAndValidateRecipe(raw: string): GeneratedRecipe | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: Partial<GeneratedRecipe>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedRecipe>;
  } catch {
    return null;
  }

  if (
    !parsed.name_hinglish ||
    !Array.isArray(parsed.ingredients) ||
    parsed.ingredients.length === 0 ||
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0
  ) {
    return null;
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

/** Transcript extraction model — gpt-5-mini (allowed in the OpenAI project since session-33). */
const TRANSCRIPT_MODEL = process.env.OPENAI_TRANSCRIPT_MODEL ?? 'gpt-5-mini';

const TRANSCRIPT_SYSTEM_PROMPT = `You are Chef Arti, a North Indian home cooking expert.
You will be given a (possibly noisy, auto-generated) YouTube recipe video transcript.
Extract ONE complete homemade recipe from it. If the transcript is unclear or
incomplete, fill the gaps with your own knowledge of the dish — the final recipe
must always be complete and cookable.
Reply ONLY with valid JSON in this exact shape — no markdown, no prose:
{
  "name_hinglish": string,
  "description": string,
  "ingredients": [{"name": string, "qty_desi": string, "qty_metric": string, "scale_type": "linear"|"salt"|"spice"|"oil"|"water"|"fixed"}],
  "steps": [{"step": number, "instruction": string, "time_minutes": number}],
  "cook_time_minutes": number,
  "vibes": string[],
  "tags": string[]
}
Rules: realistic ghar ka khana, no fancy/restaurant ingredients, no restaurant-style
dishes. 3 to 10 steps. Quantities use desi measures (katori, chammach) in qty_desi
and grams/ml in qty_metric. All text in Hinglish with a warm, respectful "aap" tone.
description is one warm Hinglish sentence.`;

/**
 * Extracts a structured GeneratedRecipe from a YouTube transcript using
 * gpt-4o-mini (~8x cheaper than full generation). Returns null on any
 * parse/validation failure so the caller can fall back to generateRecipe.
 */
export async function extractRecipeFromTranscript(
  transcript: string,
  dishName: string,
  ctx: { familySize: number; dietType: string },
): Promise<GeneratedRecipe | null> {
  try {
    const res = await openai.chat.completions.create({
      model: TRANSCRIPT_MODEL,
      messages: [
        { role: 'system', content: TRANSCRIPT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Dish: ${dishName}
Family size: ${ctx.familySize} log (quantities should be realistic for this many people)
Diet: ${ctx.dietType}

Video transcript:
${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0].message.content ?? '';
    return parseAndValidateRecipe(raw);
  } catch (err) {
    console.error(
      '[yt-pipeline] extractRecipeFromTranscript error:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Full CASE 2 pipeline: YouTube search (free) → transcript (free) →
 * gpt-4o-mini extraction (~₹0.5). Any failure along the way falls back to
 * the original direct generateRecipe (CHAT_MODEL, ~₹4) with video: null.
 */
export async function generateRecipeViaYouTube(
  ingredients: string[],
  query: string | undefined,
  ctx: { familySize: number; dietType: string },
): Promise<{ recipe: GeneratedRecipe; video: YouTubeVideo | null }> {
  const dishName = query ?? ingredients.join(' ');

  const video = await searchYouTubeRecipe(dishName);
  if (video) {
    const transcript = await extractTranscript(video.videoId);
    if (transcript) {
      const recipe = await extractRecipeFromTranscript(transcript, dishName, ctx);
      if (recipe) {
        console.log(
          `[yt-pipeline] used YouTube transcript: ${video.videoId} (${video.channelName})`,
        );
        return { recipe, video };
      }
      console.log('[yt-pipeline] transcript extraction failed, falling back to GPT');
    } else {
      console.log(`[yt-pipeline] no transcript for ${video.videoId}, falling back to GPT`);
    }
  } else {
    console.log('[yt-pipeline] no YouTube video found, falling back to GPT');
  }

  const recipe = await generateRecipe(ingredients, query);
  return { recipe, video: null };
}
