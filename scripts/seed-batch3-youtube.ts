/**
 * scripts/seed-batch3-youtube.ts — Session 33
 *
 * Seeds 50 gap-filling recipes (non-veg / jain / vegan / new regions) via the
 * cheap YouTube pipeline: search (free) → transcript (free) → gpt-5-mini
 * extraction → embedding → gpt-image-1 thumbnail → INSERT recipes (curated).
 *
 * Per-dish flow:
 *   1. DEDUP: name_hinglish ILIKE any dedup term OR tags overlap → skip
 *   2. searchYouTubeRecipe → extractTranscript → extract (gpt-5-mini)
 *      Any miss → SKIP and report (NO pure-GPT fallback for batch seeding)
 *   3. getEmbedding(embedding_text)
 *   4. generateThumbnail(id, name)
 *   5. INSERT recipes (source='curated', pinned diet/region/tags, youtube_*)
 *
 * Run:  npx tsx scripts/seed-batch3-youtube.ts --dry-run   (dedup checks only)
 *       npx tsx scripts/seed-batch3-youtube.ts             (live)
 * Flags: --dry-run | --limit N (live-run only the first N pending targets)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { searchYouTubeRecipeCandidates, extractTranscript } from '../src/lib/youtube';
import { generateThumbnail } from '../src/lib/thumbnail';
import { buildRecipeEmbeddingText } from '../src/app/api/admin/_lib/embedding';
import type {
  Ingredient,
  RecipeStep,
  RecipeCategory,
  DietType,
  RegionOrigin,
  SpiceLevel,
  CookingStyle,
  Heaviness,
  VibeBadgeKey,
} from '../src/types/index';

const EXTRACT_MODEL = process.env.OPENAI_TRANSCRIPT_MODEL ?? 'gpt-5-mini';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const COST_PER_RECIPE_INR = 3.5; // transcript extraction + thumbnail, per gap analysis

// ─────────────────────────────────────
// Target list — 50 dishes (gap analysis)
// ─────────────────────────────────────

interface Target {
  dish: string; // display name + YouTube search seed
  dedupTerms: string[]; // ILIKE terms against recipes.name_hinglish
  dedupTags: string[]; // overlap terms against recipes.tags
  category: RecipeCategory;
  dietType: 'veg' | 'non-veg' | 'eggetarian';
  region: RegionOrigin;
  pinnedTags: string[]; // always merged into tags
  excludedItems: string[];
  jain?: boolean;
  vegan?: boolean;
  dietNote?: string; // extra instruction for the extraction prompt
}

const NON_VEG_NOTE =
  'This is a NON-VEG North Indian ghar-style dish. Homemade dhaba-free style, not restaurant.';
const JAIN_NOTE =
  'This MUST be a JAIN recipe: absolutely NO onion, NO garlic, NO potato, NO ginger, NO root vegetables. Use hing (asafoetida) for flavour.';
const VEGAN_NOTE =
  'This MUST be 100% VEGAN (plant-based): NO ghee, NO butter, NO paneer, NO dahi, NO cream, NO milk. Use tel (oil) for cooking.';
const REGION_NOTE = (r: string) =>
  `This is a ${r} dish, but written as the version a North Indian ghar would cook ("North Indian ghar mein banne wala version").`;

const TARGETS: Target[] = [
  // ── Non-veg (15) ──
  { dish: 'Ghar Wali Chicken Curry', dedupTerms: ['chicken curry'], dedupTags: ['chicken-curry'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Sukha Chicken Fry', dedupTerms: ['chicken fry'], dedupTags: ['chicken-fry'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Chicken Roast Ghar Style', dedupTerms: ['chicken roast'], dedupTags: ['chicken-roast'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Kadai Chicken', dedupTerms: ['kadai chicken'], dedupTags: ['kadai-chicken'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Palak Chicken', dedupTerms: ['palak chicken'], dedupTags: ['palak-chicken'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Achari Chicken', dedupTerms: ['achari chicken'], dedupTags: ['achari-chicken'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Chicken Korma Ghar Wala', dedupTerms: ['chicken korma'], dedupTags: ['chicken-korma'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Chicken Pulao', dedupTerms: ['chicken pulao'], dedupTags: ['chicken-pulao'], category: 'chawal', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['chicken', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Mutton Curry Ghar Wali', dedupTerms: ['mutton curry'], dedupTags: ['mutton-curry'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['mutton', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Keema Matar', dedupTerms: ['keema'], dedupTags: ['keema'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['mutton', 'keema', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Mutton Rogan Josh Ghar Style', dedupTerms: ['rogan josh'], dedupTags: ['rogan-josh'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['mutton', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Machli ka Salan', dedupTerms: ['machli', 'fish curry'], dedupTags: ['fish-curry'], category: 'sabzi', dietType: 'non-veg', region: 'pan-north-indian', pinnedTags: ['fish', 'non-veg'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Amritsari Fish Fry', dedupTerms: ['fish fry'], dedupTags: ['fish-fry'], category: 'nashta', dietType: 'non-veg', region: 'Punjab', pinnedTags: ['fish', 'non-veg', 'snack'], excludedItems: [], dietNote: NON_VEG_NOTE },
  { dish: 'Anda Bhurji', dedupTerms: ['anda bhurji', 'egg bhurji'], dedupTags: ['anda-bhurji'], category: 'nashta', dietType: 'eggetarian', region: 'pan-north-indian', pinnedTags: ['anda', 'egg'], excludedItems: [], dietNote: 'Egg-based (eggetarian) homemade dish.' },
  { dish: 'Anda Paratha', dedupTerms: ['anda paratha', 'egg paratha'], dedupTags: ['anda-paratha'], category: 'nashta', dietType: 'eggetarian', region: 'pan-north-indian', pinnedTags: ['anda', 'egg', 'paratha'], excludedItems: [], dietNote: 'Egg-based (eggetarian) homemade dish.' },

  // ── Jain (8) — diet_type stays 'veg' (RPC maps jain users → veg); tagged 'jain' ──
  { dish: 'Jain Dal Tadka', dedupTerms: ['jain dal'], dedupTags: ['jain-dal'], category: 'dal', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Kadhi', dedupTerms: ['jain kadhi'], dedupTags: ['jain-kadhi'], category: 'dal', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Khichdi', dedupTerms: ['jain khichdi'], dedupTags: ['jain-khichdi'], category: 'chawal', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Bhindi Sabzi', dedupTerms: ['jain bhindi'], dedupTags: ['jain-bhindi'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Lauki Kofta', dedupTerms: ['jain lauki', 'jain kofta'], dedupTags: ['jain-kofta'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Paneer Tamatar Sabzi', dedupTerms: ['jain paneer'], dedupTags: ['jain-paneer'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Kele ki Sabzi', dedupTerms: ['kele ki sabzi', 'raw banana'], dedupTags: ['jain-kela'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },
  { dish: 'Jain Sev Tamatar Sabzi', dedupTerms: ['sev tamatar', 'sev tameta'], dedupTags: ['sev-tamatar'], category: 'sabzi', dietType: 'veg', region: 'gujarati', pinnedTags: ['jain', 'no-onion-garlic'], excludedItems: ['onion', 'garlic'], jain: true, dietNote: JAIN_NOTE },

  // ── Vegan (7) — diet_type 'veg' + tag 'vegan' ──
  { dish: 'Tofu Bhurji', dedupTerms: ['tofu'], dedupTags: ['tofu'], category: 'nashta', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan', 'protein'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  { dish: 'Vegan Soya Chaap Masala', dedupTerms: ['chaap'], dedupTags: ['soya-chaap'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan', 'protein'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  { dish: 'Mushroom Matar', dedupTerms: ['mushroom matar'], dedupTags: ['mushroom-matar'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  { dish: 'Kathal ki Sabzi', dedupTerms: ['kathal'], dedupTags: ['kathal'], category: 'sabzi', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  // dedup terms narrowed: existing "Shakarkandi Halwa" is a different dish
  { dish: 'Shakarkandi Chaat', dedupTerms: ['shakarkandi chaat'], dedupTags: ['shakarkandi-chaat'], category: 'nashta', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan', 'chaat'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  { dish: 'Til Gud Ladoo', dedupTerms: ['til gud', 'til ladoo', 'til ke ladoo'], dedupTags: ['til-ladoo'], category: 'meetha', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },
  { dish: 'Namkeen Daliya', dedupTerms: ['namkeen daliya', 'vegetable daliya'], dedupTags: ['daliya'], category: 'nashta', dietType: 'veg', region: 'pan-north-indian', pinnedTags: ['vegan', 'healthy'], excludedItems: [], vegan: true, dietNote: VEGAN_NOTE },

  // ── South Indian (5) ──
  { dish: 'Dosa Ghar Wala', dedupTerms: ['dosa'], dedupTags: ['dosa'], category: 'nashta', dietType: 'veg', region: 'south-indian', pinnedTags: ['south-indian'], excludedItems: [], dietNote: REGION_NOTE('South Indian') },
  { dish: 'Idli Sambhar', dedupTerms: ['idli'], dedupTags: ['idli'], category: 'nashta', dietType: 'veg', region: 'south-indian', pinnedTags: ['south-indian'], excludedItems: [], dietNote: REGION_NOTE('South Indian') },
  // dedup terms narrowed: existing "Sevai Upma" is a different dish from rava upma
  { dish: 'Rava Upma', dedupTerms: ['rava upma', 'sooji upma'], dedupTags: ['rava-upma'], category: 'nashta', dietType: 'veg', region: 'south-indian', pinnedTags: ['south-indian'], excludedItems: [], dietNote: REGION_NOTE('South Indian') },
  { dish: 'Lemon Rice', dedupTerms: ['lemon rice', 'nimbu chawal'], dedupTags: ['lemon-rice'], category: 'chawal', dietType: 'veg', region: 'south-indian', pinnedTags: ['south-indian'], excludedItems: [], dietNote: REGION_NOTE('South Indian') },
  { dish: 'Rasam', dedupTerms: ['rasam'], dedupTags: ['rasam'], category: 'dal', dietType: 'veg', region: 'south-indian', pinnedTags: ['south-indian'], excludedItems: [], dietNote: REGION_NOTE('South Indian') },

  // ── Bengali (5) ──
  { dish: 'Macher Jhol', dedupTerms: ['macher', 'machher'], dedupTags: ['macher-jhol'], category: 'sabzi', dietType: 'non-veg', region: 'bengali', pinnedTags: ['bengali', 'fish', 'non-veg'], excludedItems: [], dietNote: REGION_NOTE('Bengali') + ' ' + NON_VEG_NOTE },
  { dish: 'Aloo Posto', dedupTerms: ['posto'], dedupTags: ['posto'], category: 'sabzi', dietType: 'veg', region: 'bengali', pinnedTags: ['bengali'], excludedItems: [], dietNote: REGION_NOTE('Bengali') },
  { dish: 'Begun Bhaja', dedupTerms: ['begun'], dedupTags: ['begun-bhaja'], category: 'sabzi', dietType: 'veg', region: 'bengali', pinnedTags: ['bengali'], excludedItems: [], dietNote: REGION_NOTE('Bengali') },
  { dish: 'Cholar Dal', dedupTerms: ['cholar'], dedupTags: ['cholar-dal'], category: 'dal', dietType: 'veg', region: 'bengali', pinnedTags: ['bengali'], excludedItems: [], dietNote: REGION_NOTE('Bengali') },
  { dish: 'Bengali Khichuri', dedupTerms: ['khichuri'], dedupTags: ['khichuri'], category: 'chawal', dietType: 'veg', region: 'bengali', pinnedTags: ['bengali'], excludedItems: [], dietNote: REGION_NOTE('Bengali') },

  // ── Gujarati (5) ──
  { dish: 'Dhokla', dedupTerms: ['dhokla'], dedupTags: ['dhokla'], category: 'nashta', dietType: 'veg', region: 'gujarati', pinnedTags: ['gujarati'], excludedItems: [], dietNote: REGION_NOTE('Gujarati') },
  { dish: 'Thepla', dedupTerms: ['thepla'], dedupTags: ['thepla'], category: 'roti', dietType: 'veg', region: 'gujarati', pinnedTags: ['gujarati'], excludedItems: [], dietNote: REGION_NOTE('Gujarati') },
  { dish: 'Gujarati Kadhi', dedupTerms: ['gujarati kadhi'], dedupTags: ['gujarati-kadhi'], category: 'dal', dietType: 'veg', region: 'gujarati', pinnedTags: ['gujarati'], excludedItems: [], dietNote: REGION_NOTE('Gujarati') },
  { dish: 'Khandvi', dedupTerms: ['khandvi'], dedupTags: ['khandvi'], category: 'nashta', dietType: 'veg', region: 'gujarati', pinnedTags: ['gujarati'], excludedItems: [], dietNote: REGION_NOTE('Gujarati') },
  { dish: 'Handvo', dedupTerms: ['handvo'], dedupTags: ['handvo'], category: 'nashta', dietType: 'veg', region: 'gujarati', pinnedTags: ['gujarati'], excludedItems: [], dietNote: REGION_NOTE('Gujarati') },

  // ── Maharashtrian (5) ──
  { dish: 'Kanda Poha', dedupTerms: ['poha'], dedupTags: ['poha'], category: 'nashta', dietType: 'veg', region: 'maharashtrian', pinnedTags: ['maharashtrian'], excludedItems: [], dietNote: REGION_NOTE('Maharashtrian') },
  { dish: 'Pav Bhaji', dedupTerms: ['pav bhaji'], dedupTags: ['pav-bhaji'], category: 'nashta', dietType: 'veg', region: 'maharashtrian', pinnedTags: ['maharashtrian'], excludedItems: [], dietNote: REGION_NOTE('Maharashtrian') },
  { dish: 'Misal Pav', dedupTerms: ['misal'], dedupTags: ['misal'], category: 'nashta', dietType: 'veg', region: 'maharashtrian', pinnedTags: ['maharashtrian'], excludedItems: [], dietNote: REGION_NOTE('Maharashtrian') },
  { dish: 'Puran Poli', dedupTerms: ['puran poli'], dedupTags: ['puran-poli'], category: 'meetha', dietType: 'veg', region: 'maharashtrian', pinnedTags: ['maharashtrian'], excludedItems: [], dietNote: REGION_NOTE('Maharashtrian') },
  { dish: 'Thalipeeth', dedupTerms: ['thalipeeth'], dedupTags: ['thalipeeth'], category: 'roti', dietType: 'veg', region: 'maharashtrian', pinnedTags: ['maharashtrian'], excludedItems: [], dietNote: REGION_NOTE('Maharashtrian') },
];

// ─────────────────────────────────────
// Validation constants
// ─────────────────────────────────────

const VALID_VIBES: VibeBadgeKey[] = [
  'halki-dish', 'taakat-wali', 'jaldi-bane', 'bacchon-ki-fav', 'tyohar-special',
  'teekha-alert', 'vrat-wali', 'comfort-food', 'tiffin-ready', 'monsoon-special',
  'sardi-warmth', 'garmi-cool', 'protein-rich', 'one-pot', 'leftover-friendly',
  'guest-special', 'bujurg-friendly', 'low-oil', 'bina-pyaz-lehsun',
];
const VALID_SPICE: SpiceLevel[] = ['mild', 'medium', 'hot'];
const VALID_STYLE: CookingStyle[] = ['sukha', 'tariwala', 'bhuna', 'dum', 'tadka-based', 'steamed', 'fried', 'roasted', 'boiled'];
const VALID_HEAVINESS: Heaviness[] = ['halka', 'medium', 'bhaari'];

const JAIN_BANNED = ['pyaz', 'onion', 'lehsun', 'garlic', 'aloo', 'potato', 'adrak', 'ginger', 'gajar', 'carrot', 'mooli', 'radish', 'chukandar', 'beetroot', 'arbi', 'shakarkandi'];
const VEGAN_BANNED = ['ghee', 'paneer', 'dahi', 'curd', 'yogurt', 'makhan', 'butter', 'malai', 'cream', 'doodh', 'milk', 'khoya', 'mawa', 'cheese', 'shahad', 'honey'];

// ─────────────────────────────────────
// Extraction (gpt-5-mini)
// ─────────────────────────────────────

interface ExtractedRecipe {
  name_hinglish: string;
  name_hindi: string | null;
  description: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  cook_time_minutes: number;
  prep_time_minutes: number;
  soak_required: boolean;
  spice_level: SpiceLevel;
  cooking_style: CookingStyle;
  heaviness: Heaviness;
  meal_type: string[];
  goes_well_with: string[];
  vibes: VibeBadgeKey[];
  tags: string[];
}

const EXTRACT_SYSTEM_PROMPT = `You are Chef Arti, a North Indian home cooking expert.
You will be given a (possibly noisy, auto-generated) YouTube recipe video transcript.
Extract ONE complete homemade recipe from it. If the transcript is unclear or incomplete,
fill the gaps with your own knowledge of the dish — the final recipe must be complete and cookable.
Reply ONLY with valid JSON in this exact shape — no markdown, no prose:
{
  "name_hinglish": string,
  "name_hindi": string (Devanagari),
  "description": string (one warm Hinglish sentence),
  "ingredients": [{"name": string, "prep": string optional, "qty_desi": string, "qty_metric": string, "scale_type": "linear"|"salt"|"spice"|"oil"|"water"|"fixed"}],
  "steps": [{"step": number, "instruction": string, "time_minutes": number}],
  "cook_time_minutes": number,
  "prep_time_minutes": number,
  "soak_required": boolean,
  "spice_level": "mild"|"medium"|"hot",
  "cooking_style": "sukha"|"tariwala"|"bhuna"|"dum"|"tadka-based"|"steamed"|"fried"|"roasted"|"boiled",
  "heaviness": "halka"|"medium"|"bhaari",
  "meal_type": subset of ["breakfast","lunch","dinner","snack"],
  "goes_well_with": string[] (e.g. ["roti","jeera-rice","chaas"]),
  "vibes": subset of [${VALID_VIBES.map((v) => `"${v}"`).join(',')}] (max 3),
  "tags": string[] (lowercase kebab slugs)
}
Rules: realistic ghar ka khana, no fancy/restaurant ingredients, no restaurant-style dishes.
3 to 12 steps. Quantities for 4 people: desi measures (katori, chammach) in qty_desi, grams/ml in qty_metric.
Main ingredients use scale_type "linear"; namak "salt"; masale "spice"; tel/ghee "oil"; paani "water"; whole spices/garnish "fixed".
All text in Hinglish with a warm, respectful "aap" tone — never "tu".`;

async function extractFullRecipe(
  openai: OpenAI,
  transcript: string,
  t: Target,
): Promise<ExtractedRecipe | null> {
  try {
    const res = await openai.chat.completions.create({
      model: EXTRACT_MODEL,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Dish: ${t.dish}
Family size: 4 log
${t.dietNote ?? ''}

Video transcript:
${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0].message.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const p = JSON.parse(jsonMatch[0]) as Partial<ExtractedRecipe>;

    if (
      !p.name_hinglish ||
      !Array.isArray(p.ingredients) || p.ingredients.length === 0 ||
      !Array.isArray(p.steps) || p.steps.length === 0
    ) {
      return null;
    }

    return {
      name_hinglish: p.name_hinglish,
      name_hindi: p.name_hindi ?? null,
      description: p.description ?? '',
      ingredients: p.ingredients as Ingredient[],
      steps: p.steps as RecipeStep[],
      cook_time_minutes: p.cook_time_minutes ?? 30,
      prep_time_minutes: p.prep_time_minutes ?? 10,
      soak_required: p.soak_required ?? false,
      spice_level: VALID_SPICE.includes(p.spice_level as SpiceLevel) ? (p.spice_level as SpiceLevel) : 'medium',
      cooking_style: VALID_STYLE.includes(p.cooking_style as CookingStyle) ? (p.cooking_style as CookingStyle) : 'tariwala',
      heaviness: VALID_HEAVINESS.includes(p.heaviness as Heaviness) ? (p.heaviness as Heaviness) : 'medium',
      meal_type: Array.isArray(p.meal_type) && p.meal_type.length > 0 ? p.meal_type : ['lunch', 'dinner'],
      goes_well_with: Array.isArray(p.goes_well_with) ? p.goes_well_with : [],
      vibes: ((p.vibes ?? []) as string[]).filter((v): v is VibeBadgeKey => VALID_VIBES.includes(v as VibeBadgeKey)).slice(0, 3),
      tags: Array.isArray(p.tags) ? p.tags : [],
    };
  } catch (err) {
    console.error(`  [extract] ${t.dish}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Enforce jain/vegan ingredient rules. Banned non-main ingredients are dropped
 * (vegan ghee/makhan is substituted with Tel); a banned MAIN (linear) ingredient
 * fails the recipe — better to skip than ship a wrong jain/vegan recipe.
 */
function enforceDietRules(t: Target, ingredients: Ingredient[]): { ok: boolean; ingredients: Ingredient[]; note?: string } {
  const banned = t.jain ? JAIN_BANNED : t.vegan ? VEGAN_BANNED : null;
  if (!banned) return { ok: true, ingredients };

  // Plant-based versions of dairy words are fine for vegan dishes
  // ("soya curd", "vegan dahi", "coconut milk", "cashew cream")
  const PLANT_MARKERS = ['soya', 'soy ', 'tofu', 'vegan', 'plant', 'coconut', 'nariyal', 'cashew', 'kaju', 'badam', 'almond', 'peanut', 'mungfali'];

  const out: Ingredient[] = [];
  for (const ing of ingredients) {
    const name = ing.name.toLowerCase();
    const isPlantBased = t.vegan && PLANT_MARKERS.some((m) => name.includes(m));
    const hit = isPlantBased ? undefined : banned.find((b) => name.includes(b));
    if (!hit) { out.push(ing); continue; }
    if (t.vegan && (hit === 'ghee' || hit === 'makhan' || hit === 'butter')) {
      out.push({ ...ing, name: 'Tel' });
      continue;
    }
    if (ing.scale_type === 'linear') {
      return { ok: false, ingredients: [], note: `banned main ingredient "${ing.name}" (${hit})` };
    }
    // non-main banned ingredient → drop it
  }
  return { ok: true, ingredients: out };
}

// ─────────────────────────────────────
// Dedup
// ─────────────────────────────────────

type SB = ReturnType<typeof createClient>;

async function findExisting(supabase: SB, t: Target): Promise<string | null> {
  const orFilter = t.dedupTerms.map((term) => `name_hinglish.ilike.%${term}%`).join(',');
  const { data: byName, error: e1 } = await supabase
    .from('recipes').select('id,name_hinglish').or(orFilter).limit(1);
  if (e1) throw new Error(`dedup name query failed: ${e1.message}`);
  if (byName && byName.length > 0) return byName[0].name_hinglish as string;

  const { data: byTag, error: e2 } = await supabase
    .from('recipes').select('id,name_hinglish').overlaps('tags', t.dedupTags).limit(1);
  if (e2) throw new Error(`dedup tag query failed: ${e2.message}`);
  if (byTag && byTag.length > 0) return byTag[0].name_hinglish as string;

  return null;
}

// ─────────────────────────────────────
// Main
// ─────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Phase A — dedup all 50 targets
  const toCreate: Target[] = [];
  const skipped: Array<{ dish: string; existing: string }> = [];
  for (const t of TARGETS) {
    const existing = await findExisting(supabase, t);
    if (existing) {
      skipped.push({ dish: t.dish, existing });
      console.log(`⏭  already exists: ${t.dish} (matches "${existing}")`);
    } else {
      toCreate.push(t);
    }
  }

  console.log('\n━━━ Dedup Summary ━━━');
  console.log(`Would create: ${toCreate.length} | Already exist: ${skipped.length}`);
  console.log(`To create: [${toCreate.map((t) => t.dish).join(', ')}]`);
  if (skipped.length > 0) {
    console.log(`Skipped: [${skipped.map((s) => `${s.dish}→${s.existing}`).join(', ')}]`);
  }
  console.log(
    `Estimated cost: ~${toCreate.length} × ₹${COST_PER_RECIPE_INR} (transcript+thumbnail) = ₹${(toCreate.length * COST_PER_RECIPE_INR).toFixed(0)}`,
  );

  if (dryRun) {
    console.log('\n[dry-run] No API calls made beyond dedup checks. Re-run without --dry-run to seed.');
    return;
  }

  // Phase B — live pipeline
  requireEnv('YOUTUBE_DATA_API');
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });

  const created: string[] = [];
  const failed: Array<{ dish: string; reason: string }> = [];
  const queue = toCreate.slice(0, limit);

  for (const [i, t] of queue.entries()) {
    console.log(`\n[${i + 1}/${queue.length}] ${t.dish}`);
    try {
      const candidates = await searchYouTubeRecipeCandidates(t.dish);
      if (candidates.length === 0) {
        failed.push({ dish: t.dish, reason: 'youtube search failed' });
        console.log('  ❌ youtube failed: no video found');
        continue;
      }

      // Walk candidates by views — the top video often has transcripts disabled
      let video = candidates[0];
      let transcript: string | null = null;
      for (const c of candidates.slice(0, 5)) {
        const tr = await extractTranscript(c.videoId);
        if (tr) {
          video = c;
          transcript = tr;
          break;
        }
        console.log(`  ⏭  no transcript on ${c.videoId} (${c.channelName}), trying next candidate`);
      }
      if (!transcript) {
        failed.push({ dish: t.dish, reason: 'no transcript on any candidate' });
        console.log('  ❌ youtube failed: no transcript on any candidate');
        continue;
      }
      console.log(`  📺 ${video.title} — ${video.channelName} (${video.viewCount.toLocaleString()} views)`);

      const extracted = await extractFullRecipe(openai, transcript, t);
      if (!extracted) {
        failed.push({ dish: t.dish, reason: 'extraction failed' });
        console.log('  ❌ extraction failed');
        continue;
      }

      const dietCheck = enforceDietRules(t, extracted.ingredients);
      if (!dietCheck.ok) {
        failed.push({ dish: t.dish, reason: `diet rule violation: ${dietCheck.note}` });
        console.log(`  ❌ diet rule violation: ${dietCheck.note}`);
        continue;
      }

      const tags = Array.from(new Set([...extracted.tags, ...t.pinnedTags, ...t.dedupTags]));
      const vibes = t.jain
        ? Array.from(new Set<VibeBadgeKey>(['bina-pyaz-lehsun', ...extracted.vibes])).slice(0, 3)
        : extracted.vibes;

      const row = {
        id: randomUUID(),
        name_hinglish: extracted.name_hinglish,
        name_hindi: extracted.name_hindi,
        description: extracted.description,
        category: t.category,
        meal_type: extracted.meal_type,
        diet_type: t.dietType,
        is_vrat_friendly: false,
        excluded_items: t.excludedItems,
        ingredients: dietCheck.ingredients,
        steps: extracted.steps,
        cook_time_minutes: extracted.cook_time_minutes,
        prep_time_minutes: extracted.prep_time_minutes,
        soak_required: extracted.soak_required,
        base_family_size: 4,
        spice_level: extracted.spice_level,
        cooking_style: extracted.cooking_style,
        region_origin: t.region,
        heaviness: extracted.heaviness,
        goes_well_with: extracted.goes_well_with,
        vibes,
        tags,
        source: 'curated',
        youtube_video_id: video.videoId,
        youtube_video_url: video.url,
        youtube_channel_name: video.channelName,
      };

      const embeddingText = buildRecipeEmbeddingText(row);
      const embRes = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: embeddingText });
      const embedding = embRes.data[0].embedding;

      console.log('  🎨 generating thumbnail (may take ~1 min)...');
      const thumbnailUrl = await generateThumbnail(row.id, extracted.name_hinglish);

      const { error } = await supabase.from('recipes').insert({
        ...row,
        embedding_text: embeddingText,
        embedding,
        thumbnail_url: thumbnailUrl,
        thumbnail_source: thumbnailUrl ? 'ai' : 'none',
      });
      if (error) throw new Error(`insert failed: ${error.message}`);

      created.push(extracted.name_hinglish);
      console.log(`  ✅ seeded: ${extracted.name_hinglish}${thumbnailUrl ? '' : ' (no thumbnail)'}`);
      await sleep(300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ dish: t.dish, reason: msg });
      console.error(`  ❌ ${t.dish}: ${msg}`);
    }
  }

  console.log('\n━━━ Batch 3 Seed Summary ━━━');
  console.log(`Created: ${created.length} | Failed: ${failed.length} | Skipped (dedup): ${skipped.length}`);
  if (failed.length > 0) {
    console.log('Failed (manual review):');
    for (const f of failed) console.log(`  - ${f.dish}: ${f.reason}`);
  }
  console.log(`Cost: ~₹${(created.length * COST_PER_RECIPE_INR).toFixed(0)}`);
}

main().catch((err: unknown) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
