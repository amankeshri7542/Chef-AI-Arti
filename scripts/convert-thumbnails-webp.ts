/**
 * scripts/convert-thumbnails-webp.ts
 * Converts existing PNG recipe thumbnails to WebP (800px, q82), uploads to S3
 * as thumbnails/{id}.webp, and points recipes.thumbnail_url at the CloudFront URL.
 *
 * Run: npx tsx scripts/convert-thumbnails-webp.ts [--dry-run] [--delete-old]
 *   --dry-run     Download + convert to measure savings, but no upload / DB write
 *   --delete-old  Delete the old PNG object from S3 after WebP upload
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

const QUALITY = 82;
const MAX_DIM = 800;

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  credentials: {
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
  },
});
const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
);
const BUCKET = process.env.AWS_S3_BUCKET_NAME ?? 'chief-arti-fridge-scans';
const CF_DOMAIN = requireEnv('CLOUDFRONT_DOMAIN');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function s3KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const deleteOld = process.argv.includes('--delete-old');

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name_hinglish, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .order('name_hinglish');

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);

  const targets = (recipes ?? []).filter(
    (r) => r.thumbnail_url && !r.thumbnail_url.endsWith('.webp'),
  );

  console.log(
    `\n🖼️  ${targets.length} thumbnail(s) to convert${isDryRun ? ' [DRY RUN — no uploads/DB writes]' : ''}${deleteOld ? ' [will delete old PNGs]' : ''}\n`,
  );

  let converted = 0;
  let failed = 0;
  let totalOld = 0;
  let totalNew = 0;

  for (const recipe of targets) {
    try {
      const response = await fetch(recipe.thumbnail_url!);
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      const webpBuffer = await sharp(buffer)
        .resize(MAX_DIM, MAX_DIM, { fit: 'cover', position: 'center' })
        .webp({ quality: QUALITY, effort: 4 })
        .toBuffer();

      totalOld += buffer.length;
      totalNew += webpBuffer.length;
      const pct = Math.round((1 - webpBuffer.length / buffer.length) * 100);
      const kb = (n: number) => `${Math.round(n / 1024)}KB`;

      if (isDryRun) {
        console.log(`[dry-run] ${recipe.name_hinglish}: ${kb(buffer.length)} → ${kb(webpBuffer.length)} (${pct}% smaller)`);
        converted++;
        continue;
      }

      const key = `thumbnails/${recipe.id}.webp`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: webpBuffer,
          ContentType: 'image/webp',
        }),
      );

      const newUrl = `https://${CF_DOMAIN}/${key}`;
      const { error: updateErr } = await supabase
        .from('recipes')
        .update({ thumbnail_url: newUrl })
        .eq('id', recipe.id);
      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      if (deleteOld) {
        const oldKey = s3KeyFromUrl(recipe.thumbnail_url!);
        if (oldKey && oldKey !== key) {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
        }
      }

      console.log(`✅ ${recipe.name_hinglish}: ${kb(buffer.length)} → ${kb(webpBuffer.length)} (${pct}% smaller)`);
      converted++;
      await sleep(100);
    } catch (err) {
      console.error(`❌ ${recipe.name_hinglish}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`${isDryRun ? 'Would convert' : 'Converted'}: ${converted}, Failed: ${failed}`);
  if (totalOld > 0) {
    console.log(
      `Total: ${Math.round(totalOld / 1024 / 1024 * 10) / 10}MB → ${Math.round(totalNew / 1024 / 1024 * 10) / 10}MB (${Math.round((1 - totalNew / totalOld) * 100)}% smaller)`,
    );
  }
  console.log(`─────────────────────────────────\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
