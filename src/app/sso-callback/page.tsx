'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// After Google OAuth completes, Clerk calls this page.
// AuthenticateWithRedirectCallback handles the token exchange and redirects.
// We show a spinner so the page is never blank, and fall back after 8s so
// users are never stuck on a silent white screen if the callback hangs.
export default function SsoCallbackPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF9] px-6 text-center">
        <p className="text-4xl">🙏</p>
        <p className="mt-3 text-base font-semibold text-[#1A1A1A]">Login ho gaya!</p>
        <p className="mt-1 text-sm text-[#806244]">Redirect ho rahi hai, ek second ruko...</p>
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="mt-6 rounded-xl bg-[#E8640C] px-6 py-3 text-sm font-medium text-white"
        >
          Ghar chalein →
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF9]">
        <p className="text-4xl">🍳</p>
        <p className="mt-3 text-sm text-[#806244]">Login ho rahi hai...</p>
        <div className="mt-3 h-5 w-5 animate-spin rounded-full border-2 border-[#E8640C] border-t-transparent" />
      </div>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/api/users/sync-redirect"
        signUpForceRedirectUrl="/api/users/sync-redirect"
      />
    </>
  );
}
