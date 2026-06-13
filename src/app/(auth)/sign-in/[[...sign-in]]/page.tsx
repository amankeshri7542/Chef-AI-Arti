'use client';

import { useState, useEffect } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import { Steam } from '@/components/editorial/DishArt';

export default function SignInPage() {
  const { isLoaded, signIn } = useSignIn();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowClose(!!params.get('redirect_url'));
  }, []);

  async function googleLogin() {
    if (!isLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/api/users/sync-redirect',
      });
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('429') || message.toLowerCase().includes('rate') || message.toLowerCase().includes('too many')) {
        setError('Bahut zyada login attempts ho gayi. Thodi der mein dobara try karein 🙏');
      } else if (message.includes('422') || message.toLowerCase().includes('unprocessable') || message.toLowerCase().includes('oauth')) {
        setError('Google login abhi set up ho raha hai. Thodi der mein dobara try karein 🙏');
      } else {
        setError('Login ho nahi saka. Dobara try karein.');
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: 'var(--cream)' }}>
      {showClose && (
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push('/home');
          }}
          aria-label="Band karo"
          className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full text-[18px] transition-opacity active:opacity-70"
          style={{ background: 'var(--hero-lt)', color: 'var(--hero-dk)' }}
        >
          ✕
        </button>
      )}
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center"><Steam size={44} color="var(--terracotta)" /></div>
        <div className="t-overline mt-3" style={{ color: 'var(--hero-dk)' }}>Aapki apni rasoi</div>
        <h1 className="t-display mt-1" style={{ fontSize: 32, color: 'var(--text)' }}>Chief-AI-Arti</h1>
        <p className="t-ital mt-1" style={{ fontSize: 16, color: 'var(--muted)' }}>Aaj kya banao?</p>

        <button
          onClick={googleLogin}
          disabled={loading}
          className="r-cta tap-spring mt-10 disabled:opacity-60"
          style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: '0 2px 8px var(--shadow)' }}
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--hero)' }} />
          ) : (
            <GoogleIcon />
          )}
          Google se login karo
        </button>

        {error && (
          <div className="r-card mt-4 px-4 py-3 text-left" style={{ background: 'var(--hero-lt)', borderColor: '#F5A55B' }}>
            <p className="text-sm" style={{ color: 'var(--hero-dk)' }}>{error}</p>
          </div>
        )}

        <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
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
