/**
 * scripts/seed-recipes.ts
 * Seeds Supabase with recipes + knowledge docs, generating OpenAI embeddings.
 *
 * - Builds labeled embedding text per row (better semantic clustering).
 * - Persists `embedding_text` alongside `embedding` so we can re-embed without
 *   re-deriving the source string when the model is upgraded.
 * - Tolerates per-row failures, throttles to 200ms between embedding calls.
 *
 * Run: npx tsx scripts/seed-recipes.ts [--dry-run]
 * Reads:  scripts/seed/recipes.json, scripts/seed/knowledge.json
 * Writes: recipes table, knowledge_docs table
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { Recipe, KnowledgeDoc } from '../src/types/index';

// ─────────────────────────────────────
// Seed-file shapes (drop server-computed fields)
// ─────────────────────────────────────

type RecipeSeed = Omit<
  Recipe,
  | 'id'
  | 'embedding'
  | 'embedding_text'
  | 'created_at'
  | 'updated_at'
  | 'like_count'
  | 'saved_count'
  | 'reported_count'
  | 'reuse_count'
>;

type KnowledgeSeed = Omit<
  KnowledgeDoc,
  'embedding' | 'embedding_text' | 'created_at'
>;

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function embed(
  openai: OpenAI,
  model: string,
  input: string,
): Promise<number[]> {
  const res = await openai.embeddings.create({ model, input });
  return res.data[0].embedding as number[];
}

// ─────────────────────────────────────
// Embedding text builders — labeled segments
// ─────────────────────────────────────

/**
 * Build a labeled, structured embedding string for a recipe.
 * Labels help text-embedding-3-small cluster by semantic role rather than
 * treating the whole document as a flat bag of words.
 *
 * Only include `ingredient.name` (semantic) — never `ingredient.prep` (display-only noise).
 * Only include "main" (scale_type='linear') ingredients in the headline ingredient list;
 * spices/oil/salt/water/fixed are noise for similarity matching.
 */
export function buildRecipeEmbeddingText(r: RecipeSeed): string {
  const mainIngredients = r.ingredients
    .filter((i) => i.scale_type === 'linear')
    .map((i) => i.name);

  const spices = r.ingredients
    .filter((i) => i.scale_type === 'spice')
    .map((i) => i.name);

  const segments: string[] = [
    `Name: ${r.name_hinglish}`,
    `Region: ${r.region_origin}`,
    `Category: ${r.category} | Style: ${r.cooking_style} | Spice: ${r.spice_level} | Weight: ${r.heaviness}`,
    `Vibes: ${r.vibes.join(', ') || 'none'}`,
  ];

  if (r.goes_well_with.length > 0) {
    segments.push(`Goes well with: ${r.goes_well_with.join(', ')}`);
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

  if (r.tags.length > 0) {
    segments.push(`Tags: ${r.tags.join(', ')}`);
  }

  if (r.is_vrat_friendly) {
    segments.push(`Vrat-friendly: yes (no onion, no garlic, saatvik)`);
  }

  return segments.join('\n');
}

/**
 * Build labeled embedding text for a knowledge chunk.
 * Embeds the problem statement, intent, applicable contexts, and full content.
 * This way `"namak zyada ho gaya dal mein"` matches both the `problem` field
 * and the `applies_to: ['dal']` segment, lifting the right chunk in cosine rank.
 */
export function buildKnowledgeEmbeddingText(d: KnowledgeSeed): string {
  const segments: string[] = [
    `Type: ${d.type}`,
    `Intent: ${d.intent}`,
  ];

  if (d.problem) {
    segments.push(`Problem: ${d.problem}`);
  }

  if (d.applies_to.length > 0) {
    segments.push(`Applies to: ${d.applies_to.join(', ')}`);
  }

  if (d.ingredient_required) {
    segments.push(`Requires ingredient: ${d.ingredient_required}`);
  }

  segments.push(`Topic: ${d.topic}`);

  if (d.tags.length > 0) {
    segments.push(`Tags: ${d.tags.join(', ')}`);
  }

  segments.push(`Content: ${d.content}`);

  return segments.join('\n');
}

// ─────────────────────────────────────
// Seeders
// ─────────────────────────────────────

async function seedRecipes(
  recipes: RecipeSeed[],
  supabase: SupabaseClient | null,
  openai: OpenAI | null,
  model: string,
  dryRun: boolean,
): Promise<{ seeded: number; failed: number }> {
  let seeded = 0;
  let failed = 0;

  for (const r of recipes) {
    try {
      const embeddingText = buildRecipeEmbeddingText(r);

      if (dryRun) {
        console.log(
          `[dry-run] Would seed: ${r.name_hinglish} (embed input: "${truncate(embeddingText, 100)}")`,
        );
        seeded++;
        continue;
      }

      if (!openai || !supabase) {
        throw new Error('Clients not initialised');
      }

      const embedding = await embed(openai, model, embeddingText);

      const { error } = await supabase.from('recipes').insert({
        ...r,
        embedding_text: embeddingText,
        embedding,
      });

      if (error) throw new Error(error.message);

      console.log(`✅ Seeded: ${r.name_hinglish}`);
      seeded++;
      await sleep(200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed recipe "${r.name_hinglish}": ${msg}`);
      failed++;
    }
  }

  return { seeded, failed };
}

async function seedKnowledge(
  docs: KnowledgeSeed[],
  supabase: SupabaseClient | null,
  openai: OpenAI | null,
  model: string,
  dryRun: boolean,
): Promise<{ seeded: number; failed: number }> {
  let seeded = 0;
  let failed = 0;

  for (const d of docs) {
    try {
      const embeddingText = buildKnowledgeEmbeddingText(d);

      if (dryRun) {
        console.log(
          `[dry-run] Would seed knowledge: ${d.topic} (embed input: "${truncate(embeddingText, 100)}")`,
        );
        seeded++;
        continue;
      }

      if (!openai || !supabase) {
        throw new Error('Clients not initialised');
      }

      const embedding = await embed(openai, model, embeddingText);

      const { error } = await supabase.from('knowledge_docs').insert({
        id: d.id,
        type: d.type,
        intent: d.intent,
        problem: d.problem,
        applies_to: d.applies_to,
        ingredient_required: d.ingredient_required,
        topic: d.topic,
        tags: d.tags,
        content: d.content,
        preference_order: d.preference_order,
        embedding_text: embeddingText,
        embedding,
      });

      if (error) throw new Error(error.message);

      console.log(`✅ Seeded knowledge: ${d.topic}`);
      seeded++;
      await sleep(200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed knowledge "${d.topic}": ${msg}`);
      failed++;
    }
  }

  return { seeded, failed };
}

// ─────────────────────────────────────
// Main
// ─────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const recipesPath = path.join(__dirname, 'seed', 'recipes.json');
  const knowledgePath = path.join(__dirname, 'seed', 'knowledge.json');

  const recipes = JSON.parse(
    fs.readFileSync(recipesPath, 'utf-8'),
  ) as RecipeSeed[];
  const knowledge = JSON.parse(
    fs.readFileSync(knowledgePath, 'utf-8'),
  ) as KnowledgeSeed[];

  let supabase: SupabaseClient | null = null;
  let openai: OpenAI | null = null;
  let model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

  if (!dryRun) {
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = requireEnv('OPENAI_API_KEY');
    model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    openai = new OpenAI({ apiKey: openaiKey });
  }

  const recipeResult = await seedRecipes(
    recipes,
    supabase,
    openai,
    model,
    dryRun,
  );
  const knowledgeResult = await seedKnowledge(
    knowledge,
    supabase,
    openai,
    model,
    dryRun,
  );

  console.log('━━━ Seed Summary ━━━');
  console.log(
    `Recipes:   ${recipeResult.seeded} seeded, ${recipeResult.failed} failed`,
  );
  console.log(
    `Knowledge: ${knowledgeResult.seeded} seeded, ${knowledgeResult.failed} failed`,
  );
  console.log(`Mode:      ${dryRun ? 'dry-run' : 'live'}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Fatal: ${msg}`);
  process.exit(1);
});
