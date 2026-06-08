/**
 * scripts/estimate-nutrition.ts
 * Calls GPT-4o to estimate macros for every recipe with nutrition = null.
 *
 * Run: npx tsx scripts/estimate-nutrition.ts [--dry-run] [--force]
 *   --dry-run  Print what would be estimated without calling GPT or writing DB
 *   --force    Re-estimate even if nutrition is already set
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

interface NutritionPerServing {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface RecipeNutrition {
  per_serving: NutritionPerServing;
  base_servings: number;
  estimated_by: string;
  confidence: 'low' | 'medium' | 'high';
  heaviness: 'halka' | 'medium' | 'bhaari';
}

interface RecipeRow {
  id: string;
  name_hinglish: string;
  base_family_size: number;
  ingredients: Array<{ name: string; qty_desi: string; prep?: string }>;
  tags: string[];
  nutrition: RecipeNutrition | null;
}

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function heavinessFromCalories(cal: number): 'halka' | 'medium' | 'bhaari' {
  if (cal < 150) return 'halka';
  if (cal < 300) return 'medium';
  return 'bhaari';
}

// ─────────────────────────────────────
// Main
// ─────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });

  // Fetch recipes
  let query = supabase
    .from('recipes')
    .select('id, name_hinglish, base_family_size, ingredients, tags, nutrition')
    .order('name_hinglish');

  if (!isForce) {
    query = query.is('nutrition', null);
  }

  const { data: recipes, error } = await query;
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!recipes || recipes.length === 0) {
    console.log('No recipes to estimate. All done! ✅');
    return;
  }

  console.log(`\n📋 ${recipes.length} recipe(s) to estimate${isDryRun ? ' [DRY RUN]' : ''}${isForce ? ' [FORCE]' : ''}\n`);

  let estimated = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipe of recipes as RecipeRow[]) {
    const ingredientList = recipe.ingredients
      .map((i) => `${i.qty_desi} ${i.name}${i.prep ? ` (${i.prep})` : ''}`)
      .join(', ');

    if (isDryRun) {
      console.log(`[dry-run] Would estimate: ${recipe.name_hinglish}`);
      console.log(`   Ingredients: ${ingredientList.slice(0, 120)}${ingredientList.length > 120 ? '...' : ''}`);
      console.log(`   base_family_size: ${recipe.base_family_size}`);
      console.log('');
      skipped++;
      continue;
    }

    const prompt = `You are a nutrition expert for Indian home cooking.
Estimate macros for ONE serving of this dish (recipe makes ${recipe.base_family_size} servings total).

Recipe: ${recipe.name_hinglish}
Ingredients: ${ingredientList}

Reply ONLY with valid JSON — no explanation, no markdown:
{
  "calories": <integer>,
  "protein_g": <number, 1 decimal>,
  "carbs_g": <number, 1 decimal>,
  "fat_g": <number, 1 decimal>,
  "fiber_g": <number, 1 decimal>,
  "confidence": "low"|"medium"|"high",
  "reasoning": "<10 words max>"
}

Rules:
- Base on standard Indian home cooking methods
- Assume medium oil unless "low oil" in recipe tags
- confidence=high if all ingredients are common
- confidence=low if unusual combinations or unclear portions`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
      });

      const raw = completion.choices[0]?.message?.content ?? '';

      // Strip markdown fences if present
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
        confidence: 'low' | 'medium' | 'high';
        reasoning: string;
      };

      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error(`❌ [${recipe.name_hinglish}] JSON parse failed. Raw: ${raw.slice(0, 200)}`);
        failed++;
        await sleep(300);
        continue;
      }

      // Validate required fields
      const required = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'confidence'];
      const missing = required.filter((k) => !(k in parsed));
      if (missing.length > 0) {
        console.error(`❌ [${recipe.name_hinglish}] Missing fields: ${missing.join(', ')}`);
        failed++;
        await sleep(300);
        continue;
      }

      const nutrition: RecipeNutrition = {
        per_serving: {
          calories: Math.round(parsed.calories),
          protein_g: +parsed.protein_g.toFixed(1),
          carbs_g: +parsed.carbs_g.toFixed(1),
          fat_g: +parsed.fat_g.toFixed(1),
          fiber_g: +parsed.fiber_g.toFixed(1),
        },
        base_servings: recipe.base_family_size,
        estimated_by: 'gpt-4o',
        confidence: parsed.confidence,
        heaviness: heavinessFromCalories(Math.round(parsed.calories)),
      };

      const { error: updateError } = await supabase
        .from('recipes')
        .update({ nutrition })
        .eq('id', recipe.id);

      if (updateError) {
        console.error(`❌ [${recipe.name_hinglish}] DB update failed: ${updateError.message}`);
        failed++;
      } else {
        const h = nutrition.heaviness;
        const hLabel = h === 'halka' ? '🌿 halka' : h === 'medium' ? '🍽️ medium' : '💪 bhaari';
        console.log(
          `✅ ${recipe.name_hinglish} — ${nutrition.per_serving.calories} kcal/serving (${hLabel}) [${parsed.confidence}]`,
        );
        estimated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [${recipe.name_hinglish}] GPT error: ${msg}`);
      failed++;
    }

    await sleep(300);
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Summary:`);
  if (isDryRun) {
    console.log(`  Would estimate: ${skipped}`);
  } else {
    console.log(`  ✅ Estimated:  ${estimated}`);
    console.log(`  ❌ Failed:     ${failed}`);
  }
  console.log(`─────────────────────────────────\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
