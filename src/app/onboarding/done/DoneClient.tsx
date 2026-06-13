'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GridCard } from '@/components/editorial/RecipeCards';
import Icon from '@/components/editorial/Icon';
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
            <div className="t-overline animate-fade-in-up" style={{ color: 'var(--hero-dk)' }}>Sab set ho gaya</div>
            <h1 className="t-display animate-fade-in-up mt-1" style={{ fontSize: 26, color: 'var(--text)', animationDelay: '60ms', animationFillMode: 'backwards' }}>
              Aapki Chef Arti ready hai! 🍳
            </h1>
            <p
              className="animate-fade-in-up mt-2"
              style={{ fontSize: 13.5, color: 'var(--muted)', animationDelay: '120ms', animationFillMode: 'backwards' }}
            >
              Aapke swaad ke hisaab se Arti ne yeh chuna hai —
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {recipes.slice(0, 4).map((r, i) => (
              <GridCard key={r.id} recipe={r} idx={i} onOpen={(id) => router.push('/recipe/' + id)} />
            ))}
          </div>

          <button
            onClick={() => router.push('/home')}
            className="r-cta tap-spring animate-fade-in-up mt-auto"
            style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}
          >
            Sabhi recipes dekhein <Icon name="chevR" size={18} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}
