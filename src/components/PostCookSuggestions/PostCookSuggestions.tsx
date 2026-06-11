'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Recipe } from '@/types/index';

// Local mirror of the API shape — do NOT add to types/index.ts
interface RecommendationGroup {
  reason: string;
  based_on_recipe: string;
  recipes: Recipe[];
}

interface Props {
  recipeId: string;
  recipeName: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  sabzi: '🥬', dal: '🫘', roti: '🫓', chawal: '🍚',
  nashta: '🍳', meetha: '🍬', default: '🍽️',
};
const CATEGORY_BG: Record<string, string> = {
  sabzi: 'linear-gradient(135deg,#D4F1C4,#A8E063)',
  dal: 'linear-gradient(135deg,#FFE5B0,#FFCB6B)',
  roti: 'linear-gradient(135deg,#FFD8A8,#FFAE5E)',
  chawal: 'linear-gradient(135deg,#E8F4FD,#BFD9F2)',
  nashta: 'linear-gradient(135deg,#FDDBC2,#FBC08A)',
  meetha: 'linear-gradient(135deg,#F3D4F8,#E09EEA)',
  default: 'linear-gradient(135deg,#FDDBC2,#FBC08A)',
};

/**
 * "Yeh bhi try karein" — small suggestion row shown after the user marks a
 * recipe as cooked. Self-contained: fetches its own recommendations.
 */
export default function PostCookSuggestions({ recipeId }: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipes/recommendations?recipeId=${recipeId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { groups?: RecommendationGroup[] } | null) => {
        if (cancelled || !data?.groups) return;
        // First group that still has recipes after removing the current one
        for (const group of data.groups) {
          const others = group.recipes.filter((r) => r.id !== recipeId);
          if (others.length > 0) {
            setSuggestions(others.slice(0, 3));
            return;
          }
        }
      })
      .catch(() => {
        /* silent — section simply doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  if (suggestions.length === 0) return null;

  return (
    <section className="animate-fade-in-up mt-5">
      <p className="font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>
        Yeh bhi try karein 🍳
      </p>
      <div className="mt-2.5 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {suggestions.map((r) => {
          const emoji = CATEGORY_EMOJI[r.category] ?? CATEGORY_EMOJI.default;
          const bg = CATEGORY_BG[r.category] ?? CATEGORY_BG.default;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => router.push('/recipe/' + r.id)}
              className="tap-spring flex w-[96px] flex-shrink-0 flex-col text-left"
            >
              <div
                className="relative w-full overflow-hidden rounded-xl"
                style={{ height: 80, border: '1px solid var(--border)' }}
              >
                {r.thumbnail_url ? (
                  <Image
                    src={r.thumbnail_url}
                    alt={r.name_hinglish}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-2xl"
                    style={{ background: bg }}
                  >
                    {emoji}
                  </div>
                )}
              </div>
              <p
                className="mt-1.5 font-semibold leading-tight"
                style={{
                  fontSize: 11,
                  color: 'var(--text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.name_hinglish}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
