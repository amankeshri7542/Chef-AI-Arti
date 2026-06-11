import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'chief-arti-fridge-scans.s3.ap-south-1.amazonaws.com',
      },
      {
        // CloudFront CDN for thumbnails (docs/cloudfront-setup.md). Falls back
        // to the raw S3 hostname until CLOUDFRONT_DOMAIN is configured.
        protocol: 'https',
        hostname: process.env.CLOUDFRONT_DOMAIN ?? 'chief-arti-fridge-scans.s3.ap-south-1.amazonaws.com',
      },
      {
        // YouTube video frames — temp thumbnails for freshly promoted recipes
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    skipWaiting: true,
    // Custom Web Push handlers (push + notificationclick) live in this static file.
    importScripts: ["/push-sw.js"],
    runtimeCaching: [
      {
        // Search API — NEVER cache (always fresh; prevents stale-SW mobile bug)
        urlPattern: /\/api\/recipes\/search/,
        handler: "NetworkOnly",
      },
      {
        // All other API routes — network first with timeout fallback
        urlPattern: /\/api\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
        },
      },
      {
        // Static images (S3 thumbnails etc.)
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "static-image-assets", expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
      },
      {
        // Google fonts
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
      },
      {
        // Everything else — network first
        urlPattern: /^https?.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "others",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
});

export default withSentryConfig(withPWA(nextConfig), {
  silent: true,
  // Source-map upload only when a token is configured; otherwise build runs untouched
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
