'use client';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';

interface Props { recipe: Recipe; onClick?: () => void }

export default function RecipeCardGrid({ recipe, onClick }: Props) {
  const router = useRouter();
  const handleClick = onClick ?? (() => router.push('/recipe/' + recipe.id));

  const categoryEmoji: Record<string, string> = {
    sabzi: '🥬', dal: '🫘', roti: '🫓', chawal: '🍚',
    nashta: '🍳', meetha: '🍬', default: '🍽️',
  };
  const emoji = categoryEmoji[recipe.category] ?? categoryEmoji.default;
  const totalMin = recipe.cook_time_minutes + recipe.prep_time_minutes;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-full overflow-hidden rounded-[10px]"
      style={{ aspectRatio: '1 / 1' }}
    >
      {/* Background */}
      {recipe.thumbnail_url ? (
        <img
          src={recipe.thumbnail_url}
          alt={recipe.name_hinglish}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-5xl"
          style={{ background: 'linear-gradient(135deg, #FDDBC2, #FBC08A)' }}
        >
          {emoji}
        </div>
      )}

      {/* Vrat dot */}
      {recipe.is_vrat_friendly && (
        <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-green-500" />
      )}

      {/* Bottom overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 px-2 py-2"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      >
        <p className="line-clamp-2 text-left text-[12px] font-semibold leading-tight text-white">
          {recipe.name_hinglish}
        </p>
        <p className="mt-0.5 text-[10px] text-white/70">⏱ {totalMin} min</p>
      </div>
    </button>
  );
}
