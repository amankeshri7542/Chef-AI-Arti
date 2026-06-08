'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RecipeCardCompact from '@/components/RecipeCard/RecipeCardCompact';
import type { Recipe } from '@/types/index';

const BURST = [
  { e: '🎉', x: '-90px', y: '-70px' },
  { e: '✨', x: '80px', y: '-80px' },
  { e: '🍳', x: '-100px', y: '40px' },
  { e: '🥘', x: '95px', y: '50px' },
  { e: '🌟', x: '0px', y: '-110px' },
  { e: '✨', x: '0px', y: '90px' },
];

export default function DoneClient({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  // Reveal the content after the emoji burst (~800ms).
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col px-6 py-12"
      style={{ background: 'var(--cream)' }}
    >
      {/* Emoji burst from center */}
      <div className="pointer-events-none relative" style={{ height: 0 }}>
        <div
          className="absolute left-1/2 top-24"
          style={{ transform: 'translateX(-50%)' }}
        >
          {BURST.map(({ e, x, y }, i) => (
            <span
              key={i}
              className="absolute"
              style={
                {
                  fontSize: 32,
                  left: 0,
                  top: 0,
                  '--burst-x': x,
                  '--burst-y': y,
                  animation: 'emojiBurst 1000ms ease-out forwards',
                  animationDelay: `${i * 60}ms`,
                } as React.CSSProperties
              }
            >
              {e}
            </span>
          ))}
        </div>
      </div>

      {showContent && (
        <div className="flex flex-1 flex-col">
          <div className="mt-16 text-center">
            <h1
              className="font-display animate-fade-in-up"
              style={{ fontSize: 22, color: 'var(--terracotta)' }}
            >
              Aapki Chef Arti ready hai! 🍳
            </h1>
            <p
              className="animate-fade-in-up mt-2"
              style={{ fontSize: 13, color: 'var(--muted)', animationDelay: '120ms', animationFillMode: 'backwards' }}
            >
              Aapke liye yeh recipes hain aaj:
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {recipes.slice(0, 3).map((r, i) => (
              <div
                key={r.id}
                className="animate-card-entry"
                style={{ animationDelay: `${240 + i * 120}ms` }}
              >
                <RecipeCardCompact recipe={r} />
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/home')}
            className="font-display animate-fade-in-up mt-auto flex w-full items-center justify-center transition-transform active:scale-[0.97]"
            style={{
              minHeight: 56,
              borderRadius: 16,
              background: 'var(--saffron)',
              color: '#fff',
              fontSize: 16,
              boxShadow: '0 4px 20px var(--shadow)',
              animationDelay: '600ms',
              animationFillMode: 'backwards',
            }}
          >
            Sabhi recipes dekhein →
          </button>
        </div>
      )}
    </div>
  );
}
