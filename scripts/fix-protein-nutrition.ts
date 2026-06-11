/**
 * scripts/fix-protein-nutrition.ts
 * Re-estimates nutrition for protein-heavy recipes (non-veg, eggetarian,
 * protein-rich tagged, dal) with an improved prompt that anchors GPT on
 * exact reference values per 100g.
 *
 * Run: npx tsx scripts/fix-protein-nutrition.ts [--dry-run]
 *   --dry-run  Call GPT and print old-vs-new comparison WITHOUT writing DB
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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
  diet_type: string;
  category: string;
  tags: string[];
  base_family_size: number;
  ingredients: Array<{ name: string; qty_desi: string; prep?: string }>;
  nutrition: RecipeNutrition | null;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function heavinessFromCalories(cal: number): 'halka' | 'medium' | 'bhaari' {
  if (cal < 150) return 'halka';
  if (cal < 300) return 'medium';
  return 'bhaari';
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name_hinglish, diet_type, category, tags, base_family_size, ingredients, nutrition')
    .eq('source', 'curated')
    .or('diet_type.in.(non-veg,eggetarian),tags.cs.{protein-rich},category.eq.dal')
    .order('name_hinglish');

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!recipes?.length) {
    console.log('No matching recipes found.');
    return;
  }

  console.log(`\n📋 ${recipes.length} protein-relevant recipe(s) to re-estimate${isDryRun ? ' [DRY RUN — no DB writes]' : ''}\n`);

  let updated = 0;
  let failed = 0;
  const rows: Array<{ name: string; oldP: number | null; newP: number; oldCal: number | null; newCal: number }> = [];

  for (const recipe of recipes as RecipeRow[]) {
    const ingredientList = recipe.ingredients
      .map((i) => `${i.qty_desi} ${i.name}${i.prep ? ` (${i.prep})` : ''}`)
      .join('\n');

    const prompt = `You are a certified nutrition expert.
Calculate ACCURATE macros for ONE serving of this recipe.
Recipe makes ${recipe.base_family_size} servings total.

Recipe: ${recipe.name_hinglish}
Ingredients (TOTAL for all servings):
${ingredientList}

IMPORTANT REFERENCE VALUES (use these exactly):
- Chicken, raw: 27g protein per 100g, 165 kcal per 100g
- Mutton/Goat: 26g protein per 100g, 258 kcal per 100g
- Fish (general): 22g protein per 100g, 130 kcal per 100g
- Egg, whole: 6g protein per egg, 70 kcal per egg
- Paneer: 18g protein per 100g, 265 kcal per 100g
- Cooked dal: 9g protein per 100g, 116 kcal per 100g

Calculate per serving (total ÷ ${recipe.base_family_size}).

Reply ONLY with valid JSON — no explanation, no markdown:
{"calories":<integer>,"protein_g":<number 1 decimal>,"carbs_g":<number 1 decimal>,"fat_g":<number 1 decimal>,"fiber_g":<number 1 decimal>,"confidence":"high"|"medium"|"low","reasoning":"<10 words"}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 250,
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
        confidence: 'low' | 'medium' | 'high';
        reasoning?: string;
      };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error(`❌ [${recipe.name_hinglish}] JSON parse failed. Raw: ${raw.slice(0, 150)}`);
        failed++;
        await sleep(300);
        continue;
      }

      const required = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
      if (required.some((k) => typeof (parsed as Record<string, unknown>)[k] !== 'number')) {
        console.error(`❌ [${recipe.name_hinglish}] Missing/invalid numeric fields`);
        failed++;
        await sleep(300);
        continue;
      }

      const newNutrition: RecipeNutrition = {
        per_serving: {
          calories: Math.round(parsed.calories),
          protein_g: +parsed.protein_g.toFixed(1),
          carbs_g: +parsed.carbs_g.toFixed(1),
          fat_g: +parsed.fat_g.toFixed(1),
          fiber_g: +parsed.fiber_g.toFixed(1),
        },
        base_servings: recipe.base_family_size,
        estimated_by: 'gpt-4o-protein-fix',
        confidence: parsed.confidence ?? 'medium',
        heaviness: heavinessFromCalories(Math.round(parsed.calories)),
      };

      const oldP = recipe.nutrition?.per_serving?.protein_g ?? null;
      const oldCal = recipe.nutrition?.per_serving?.calories ?? null;
      rows.push({
        name: recipe.name_hinglish,
        oldP,
        newP: newNutrition.per_serving.protein_g,
        oldCal,
        newCal: newNutrition.per_serving.calories,
      });

      const delta = oldP != null ? (newNutrition.per_serving.protein_g - oldP).toFixed(1) : 'n/a';
      console.log(
        `${isDryRun ? '[dry-run] ' : '✅ '}${recipe.name_hinglish}: protein ${oldP ?? '—'}g → ${newNutrition.per_serving.protein_g}g (Δ${delta}) | kcal ${oldCal ?? '—'} → ${newNutrition.per_serving.calories} | ${parsed.reasoning ?? ''}`,
      );

      if (!isDryRun) {
        const { error: updateError } = await supabase
          .from('recipes')
          .update({ nutrition: newNutrition })
          .eq('id', recipe.id);
        if (updateError) {
          console.error(`❌ [${recipe.name_hinglish}] DB update failed: ${updateError.message}`);
          failed++;
        } else {
          updated++;
        }
      }
    } catch (err) {
      console.error(`❌ [${recipe.name_hinglish}] GPT error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    await sleep(300);
  }

  console.log('\n───────────── Comparison table ─────────────');
  console.log('Recipe'.padEnd(38) + 'Protein old→new'.padEnd(20) + 'Kcal old→new');
  for (const r of rows) {
    console.log(
      r.name.slice(0, 36).padEnd(38) +
        `${r.oldP ?? '—'} → ${r.newP}`.padEnd(20) +
        `${r.oldCal ?? '—'} → ${r.newCal}`,
    );
  }
  console.log('─────────────────────────────────────────────');
  console.log(isDryRun ? `Dry run complete — ${rows.length} estimated, ${failed} failed, 0 written.` : `✅ Updated: ${updated}, ❌ Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
