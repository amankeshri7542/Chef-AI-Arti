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
]);

const isPublicApi = createRouteMatcher([
  '/api/recipes/search',
  '/api/recipes/(.*)',
  '/api/webhooks/(.*)',
  '/manifest.json',
  '/icon-(.*)',
  '/sw.js',
  '/workbox-(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

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
