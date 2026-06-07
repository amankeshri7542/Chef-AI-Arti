'use client';

import { useSignIn } from '@clerk/nextjs/legacy';

export default function SignInPage() {
  const { isLoaded, signIn } = useSignIn();

  async function googleLogin() {
    if (!isLoaded || !signIn) return;
    await signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/api/users/sync-redirect',
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFDF9] px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-5xl">🍳</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#1A1A1A]">Chief-AI-Arti</h1>
        <p className="mt-1 text-base text-[#8B7355]">Aaj kya banao?</p>

        <button
          onClick={googleLogin}
          className="mt-10 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#E8640C] text-base font-medium text-white transition-opacity active:opacity-80"
        >
          <GoogleIcon />
          Google se login karo
        </button>

        <p className="mt-4 text-xs text-[#C4B8A8]">
          Login karke aap hamare Terms se agree karte hain
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#fff"
        opacity=".9"
      />
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
