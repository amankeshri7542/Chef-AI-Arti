import type { NextConfig } from "next";
// @ts-expect-error next-pwa has no types for ESM import
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // next-pwa 5.x uses webpack; silence Turbopack vs webpack mismatch warning
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'chief-arti-fridge-scans.s3.ap-south-1.amazonaws.com',
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Search API — NEVER cache (always fresh results, prevents stale SW bug)
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
})(nextConfig);
