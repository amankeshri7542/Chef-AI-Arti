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
})(nextConfig);
