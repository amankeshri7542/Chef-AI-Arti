// scripts/generate-thumbnails.ts
// Run: npx tsx scripts/generate-thumbnails.ts
// Generates AI thumbnails (gpt-image-1 → WebP → S3) for curated recipes
// that have none. Core logic lives in src/lib/thumbnail.ts.

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateThumbnail } from '../src/lib/thumbnail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name_hinglish')
    .eq('source', 'curated')
    .is('thumbnail_url', null)
    .order('cooked_count', { ascending: false });

  if (error) { console.error('Supabase error:', error); process.exit(1); }
  if (!recipes?.length) { console.log('All recipes already have thumbnails!'); return; }

  console.log(`Found ${recipes.length} recipes without thumbnails. Starting generation...`);

  for (const recipe of recipes) {
    console.log(`  Generating image for: ${recipe.name_hinglish}`);
    const url = await generateThumbnail(recipe.id, recipe.name_hinglish);
    if (!url) {
      console.error(`  Failed for ${recipe.name_hinglish}`);
      continue;
    }

    const { error: updateErr } = await supabase
      .from('recipes')
      .update({ thumbnail_url: url, thumbnail_source: 'ai' })
      .eq('id', recipe.id);

    if (updateErr) {
      console.error(`  Failed to update DB for ${recipe.name_hinglish}:`, updateErr.message);
    } else {
      console.log(`  Done: ${recipe.name_hinglish} → ${url}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\nDone! Run the app to see thumbnails.');
}

main().catch(console.error);
