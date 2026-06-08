'use client';

import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';

interface Props {
  recipe: Recipe;
  onClick?: () => void;
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

export default function RecipeCardCompact({ recipe, onClick }: Props) {
  const router = useRouter();
  const handleClick = onClick ?? (() => router.push('/recipe/' + recipe.id));

  const emoji = CATEGORY_EMOJI[recipe.category] ?? CATEGORY_EMOJI.default;
  const bg = CATEGORY_BG[recipe.category] ?? CATEGORY_BG.default;
  const totalMin = recipe.cook_time_minutes + recipe.prep_time_minutes;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-full overflow-hidden rounded-[10px] text-left transition-transform active:scale-95"
      style={{ aspectRatio: '3 / 2' }}
    >
      {/* Background */}
      {recipe.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.thumbnail_url}
          alt={recipe.name_hinglish}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: bg }} />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }}
      />

      {/* Emoji (no thumbnail) */}
      {!recipe.thumbnail_url && (
        <span className="absolute inset-0 flex items-center justify-center text-3xl">
          {emoji}
        </span>
      )}

      {/* Vrat dot */}
      {recipe.is_vrat_friendly && (
        <span
          className="absolute right-2 top-2 rounded-full text-[8px] leading-none px-1 py-0.5 font-semibold"
          style={{ background: 'rgba(255,255,255,0.85)', color: '#2D6A4F' }}
        >
          🕉️
        </span>
      )}

      {/* Text */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
        <p
          className="font-semibold text-white leading-tight"
          style={{ fontSize: 11, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {recipe.name_hinglish}
        </p>
        <p className="text-white/70 mt-0.5" style={{ fontSize: 9 }}>
          {totalMin} min
        </p>
      </div>
    </button>
  );
}
