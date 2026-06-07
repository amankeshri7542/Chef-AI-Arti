import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",   // Clerk routes new Google users here — must be public even without a page
  "/sso-callback(.*)",
  "/api/webhooks/razorpay",
  "/manifest.json",
  "/icon-(.*)\\.png",
  "/sw.js",
  "/workbox-(.*)\\.js",
]);

// In Next.js 16, proxy.ts replaces middleware.ts.
// clerkMiddleware returns a handler compatible with both default and named `proxy` exports.
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { userId } = await auth();

  // Authenticated user hitting / → redirect to /home
  if (userId && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Protect all non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
