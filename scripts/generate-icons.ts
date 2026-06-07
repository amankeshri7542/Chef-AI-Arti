import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

function generateIcon(size: number): void {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: saffron orange #E8640C with rounded corners
  ctx.fillStyle = '#E8640C';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // Subtle white circle behind emoji
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // 🍳 emoji centered
  ctx.font = `${size * 0.5}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍳', size / 2, size / 2 + size * 0.03);

  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(process.cwd(), 'public', `icon-${size}.png`);
  fs.writeFileSync(outPath, buffer);
  const stats = fs.statSync(outPath);
  console.log(`✅ Generated icon-${size}.png — ${stats.size} bytes`);
}

generateIcon(192);
generateIcon(512);
