'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// After Google OAuth completes, Clerk calls this page.
// Both new and returning users land on /api/users/sync-redirect
// which creates the Supabase row (if missing) and routes to /onboarding or /home.
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl="/api/users/sync-redirect"
      signUpForceRedirectUrl="/api/users/sync-redirect"
    />
  );
}
