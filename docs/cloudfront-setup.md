# CloudFront Setup — Recipe Thumbnails via CDN

Manual one-time setup to serve S3 recipe thumbnails through AWS CloudFront instead of hitting the S3 bucket (`chief-arti-fridge-scans`, ap-south-1) directly. Cuts latency for users (edge caching) and reduces S3 GET costs.

## 1. Create the distribution

1. AWS Console → **CloudFront** → **Create Distribution**.

## 2. Origin settings

- **Origin domain:** `chief-arti-fridge-scans.s3.ap-south-1.amazonaws.com`
  (pick it from the dropdown; if the console offers "Use website endpoint", decline — use the REST endpoint above)
- **Origin access:** Public — the bucket already has public-read on thumbnail objects, so no OAC/OAI needed.
- **Origin path:** leave **empty**.

## 3. Default cache behavior

- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Cache policy:** `CachingOptimized` (AWS managed)
- **TTL:** default 86400 seconds (24h) — matches the app's SW image cache window.
- Leave allowed methods at GET/HEAD.

## 4. Price class

- **Price class:** "Use North America, Europe, Asia, Middle East and Africa" — this **includes India edge locations** and is cheaper than "Use all edge locations".

## 5. Create + copy the domain

Click **Create Distribution**, wait for status **Deployed** (~5-10 min), then copy the **Distribution domain name**, e.g.:

```
d1abc123.cloudfront.net
```

Sanity check in a browser:
`https://d1abc123.cloudfront.net/thumbnails/<any-existing-key>.png` should render the same image as the S3 URL.

## 6. Rewrite existing thumbnail URLs in Supabase

Run in Supabase SQL Editor (replace `[YOUR_CLOUDFRONT_DOMAIN]`):

```sql
UPDATE recipes
SET thumbnail_url = REPLACE(
  thumbnail_url,
  'https://chief-arti-fridge-scans.s3.ap-south-1.amazonaws.com/',
  'https://[YOUR_CLOUDFRONT_DOMAIN]/'
)
WHERE thumbnail_url LIKE '%s3%';
```

(If community photos in `recipe_photos.s3_url` should also go through the CDN, run the same `REPLACE` against that table — optional.)

## 7. Set the env var

`next.config.ts` already reads `CLOUDFRONT_DOMAIN` for `images.remotePatterns` (falls back to the raw S3 hostname when unset).

- **.env.local:** uncomment and fill the line
  ```
  CLOUDFRONT_DOMAIN=d1abc123.cloudfront.net
  ```
- **Vercel:** `npx vercel env add CLOUDFRONT_DOMAIN production` (and preview if desired), value = the CloudFront domain (no `https://`, no trailing slash).

## 8. Deploy

```bash
npx vercel --prod
```

(Required — `CLOUDFRONT_DOMAIN` is read at build time by `next.config.ts`.)
