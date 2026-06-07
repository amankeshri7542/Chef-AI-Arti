'use client';

import Image from 'next/image';
import { Recipe, RecipeCategory } from '@/types/index';
import VibeBadges from '@/components/VibeBadges/VibeBadges';

const CATEGORY_EMOJI: Record<RecipeCategory, string> = {
  sabzi: '🥬',
  dal: '🫘',
  roti: '🫓',
  chawal: '🍚',
  nashta: '🍳',
  meetha: '🍬',
};

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const emoji = CATEGORY_EMOJI[recipe.category] ?? '🍽️';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-transform duration-100 active:scale-[0.98]"
    >
      <div
        className="flex min-h-[72px] w-full overflow-hidden bg-white"
        style={{
          border: '0.5px solid #E8DDD0',
          borderRadius: 12,
        }}
      >
        {/* Left thumbnail — 72×72 */}
        <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
          {recipe.thumbnail_url ? (
            <Image
              src={recipe.thumbnail_url}
              alt={recipe.name_hinglish}
              width={72}
              height={72}
              className="h-full w-full object-cover rounded-l-xl"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-l-xl text-2xl"
              style={{
                background: 'linear-gradient(135deg, #FDDBC2, #FBC08A)',
              }}
            >
              {emoji}
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="flex flex-1 flex-col justify-center gap-1 p-2">
          <p
            className="line-clamp-2 font-semibold"
            style={{ fontSize: 12, color: '#1A1A1A' }}
          >
            {recipe.name_hinglish}
          </p>
          <p style={{ fontSize: 10, color: '#8B7355' }}>
            ⏱ {recipe.cook_time_minutes} min · {recipe.meal_type[0]}
          </p>
          <VibeBadges vibes={recipe.vibes} />
        </div>
      </div>
    </button>
  );
}
