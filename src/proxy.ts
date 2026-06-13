import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicPage = createRouteMatcher([
  '/',
  '/home',
  '/recipe/(.*)',
  '/search',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  // Admin panel — NOT Clerk-protected; pages/APIs do their own
  // httpOnly-cookie check (see src/lib/admin-auth.ts).
  '/admin(.*)',
]);

const isPublicApi = createRouteMatcher([
  '/api/recipes/search',
  '/api/recipes/browse',
  '/api/recipes/(.*)',
  '/api/admin/(.*)',
  '/api/webhooks/(.*)',
  '/api/cron/(.*)',
  '/api/push/send',
  // sync-redirect is called by sso-callback immediately after Google OAuth.
  // Clerk's session cookie may not be readable by middleware on that first
  // request (timing), so we let it pass — the route does its own auth() check.
  '/api/users/sync-redirect',
  '/manifest.json',
  '/icon-(.*)',
  '/sw.js',
  '/workbox-(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Admin panel + admin APIs — bypass Clerk entirely (cookie auth inside),
  // and mark noindex so search engines never index the admin surface.
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Public pages and APIs — allow through
  if (isPublicPage(req) || isPublicApi(req)) {
    return NextResponse.next();
  }

  // Protected API routes — return 401 JSON (not redirect)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    if (!userId) {
      return NextResponse.json(
        { error: 'Login karein pehle' },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Protected pages — redirect to sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
