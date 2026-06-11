'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError('Galat password!');
      }
    } catch {
      setError('Kuch gadbad ho gayi — phir try karein');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: '#1A1A2E' }}
    >
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#16213E' }}
      >
        <h1 className="font-display mb-1 text-center text-2xl font-bold text-white">
          🍳 Chief Arti Admin
        </h1>
        <p className="mb-6 text-center text-sm" style={{ color: '#B8B8D0' }}>
          Internal kitchen — staff only
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          autoFocus
          className="mb-3 w-full rounded-lg border px-4 py-3 text-white outline-none"
          style={{ background: '#1A1A2E', borderColor: '#0F3460' }}
        />
        {error && (
          <p className="mb-3 text-sm font-medium text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-50"
          style={{ background: '#E8640C' }}
        >
          {loading ? 'Checking…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
