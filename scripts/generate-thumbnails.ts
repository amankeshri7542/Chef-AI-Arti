// scripts/generate-thumbnails.ts
// Run: npx tsx scripts/generate-thumbnails.ts
// Cost: ~$0.04/image (DALL-E 3) × 50 recipes ≈ $2 total

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import OpenAI from 'openai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const BUCKET = process.env.AWS_S3_BUCKET_NAME ?? 'chief-arti-fridge-scans';

async function generateAndUpload(recipeId: string, nameHinglish: string): Promise<string> {
  const prompt = `Traditional Indian home-cooked ${nameHinglish}, served in a steel katori on a wooden kitchen table, overhead shot, warm natural light, photorealistic, food photography`;

  console.log(`  Generating image for: ${nameHinglish}`);
  const imgRes = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'b64_json',
  });

  const b64 = imgRes.data?.[0]?.b64_json;
  if (!b64) throw new Error('DALL-E returned no image data');
  const buf = Buffer.from(b64, 'base64');
  const key = `thumbnails/${recipeId}.jpg`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: 'image/jpeg',
    // @ts-ignore — ACL type requires ObjectCannedACL enum but 'public-read' is valid
    ACL: 'public-read',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-south-1'}.amazonaws.com/${key}`;
  console.log(`  Uploaded: ${url}`);
  return url;
}

async function main() {
  // Fetch recipes without thumbnails
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
    try {
      const url = await generateAndUpload(recipe.id, recipe.name_hinglish);

      const { error: updateErr } = await supabase
        .from('recipes')
        .update({ thumbnail_url: url })
        .eq('id', recipe.id);

      if (updateErr) {
        console.error(`  Failed to update DB for ${recipe.name_hinglish}:`, updateErr.message);
      } else {
        console.log(`  Done: ${recipe.name_hinglish}`);
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  Failed for ${recipe.name_hinglish}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\nDone! Run the app to see thumbnails.');
}

main().catch(console.error);
