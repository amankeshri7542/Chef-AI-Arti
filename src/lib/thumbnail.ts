import OpenAI from 'openai';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Generates a food photo via gpt-image-1 (dall-e-3 fallback), converts to
 * 800px WebP and uploads to S3. Returns the CloudFront (or S3) URL, or null
 * on any failure — callers treat thumbnails as best-effort.
 *
 * Server-only (uses secret env vars). Imported by API routes and
 * scripts/generate-thumbnails.ts — no dotenv here; scripts load their own.
 */
export async function generateThumbnail(
  recipeId: string,
  nameHinglish: string,
): Promise<string | null> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const bucket = process.env.AWS_S3_BUCKET_NAME ?? 'chief-arti-fridge-scans';

    const prompt = `Traditional Indian home-cooked ${nameHinglish}, served in a steel katori on a wooden kitchen table, overhead shot, warm natural light, photorealistic, food photography`;

    let buf: Buffer;
    try {
      const imgRes = (await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
      } as Parameters<typeof openai.images.generate>[0])) as OpenAI.ImagesResponse;
      const b64 = imgRes.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-1: no b64_json in response');
      buf = Buffer.from(b64, 'base64');
    } catch (e1) {
      console.log(
        `[thumbnail] gpt-image-1 failed (${e1 instanceof Error ? e1.message : e1}), trying dall-e-3...`,
      );
      const imgRes = (await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      } as Parameters<typeof openai.images.generate>[0])) as OpenAI.ImagesResponse;
      const url = imgRes.data?.[0]?.url;
      if (!url) throw new Error('dall-e-3: no URL in response');
      const r = await fetch(url);
      if (!r.ok) throw new Error(`download failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    }

    const webpBuf = await sharp(buf)
      .resize(800, 800, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    const key = `thumbnails/${recipeId}.webp`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: webpBuf,
        ContentType: 'image/webp',
      }),
    );

    const region = process.env.AWS_REGION ?? 'ap-south-1';
    return process.env.CLOUDFRONT_DOMAIN
      ? `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    console.error(
      `[thumbnail] generation failed for ${nameHinglish}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Free, instant YouTube video thumbnail — used as temp art for pending recipes. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
