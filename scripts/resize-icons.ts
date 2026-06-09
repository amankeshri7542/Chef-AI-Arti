/**
 * scripts/resize-icons.ts
 * Resizes a source app icon into the two PWA sizes the manifest expects.
 *
 * Drop your branded icon at public/icon-new.png (or public/app-icon.png),
 * then run: npx tsx scripts/resize-icons.ts
 *
 * Writes: public/icon-192.png (192×192), public/icon-512.png (512×512)
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC = path.resolve(process.cwd(), 'public');
const CANDIDATES = ['icon-new.png', 'app-icon.png', 'icon-source.png'];

async function main(): Promise<void> {
  const source = CANDIDATES.map((f) => path.join(PUBLIC, f)).find((p) =>
    fs.existsSync(p),
  );

  if (!source) {
    console.log(
      `⏸️  No source icon found. Add your app icon as one of:\n` +
        CANDIDATES.map((f) => `   public/${f}`).join('\n') +
        `\nThen run: npx tsx scripts/resize-icons.ts`,
    );
    process.exit(0);
  }

  console.log(`Using source icon: ${path.relative(process.cwd(), source)}`);

  const targets: Array<{ size: number; out: string }> = [
    { size: 192, out: path.join(PUBLIC, 'icon-192.png') },
    { size: 512, out: path.join(PUBLIC, 'icon-512.png') },
  ];

  for (const { size, out } of targets) {
    await sharp(source)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(out);
    console.log(`✅ Wrote ${path.relative(process.cwd(), out)} (${size}×${size})`);
  }

  console.log('Done. Rebuild + redeploy to ship the new icons.');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Fatal: ${msg}`);
  process.exit(1);
});
