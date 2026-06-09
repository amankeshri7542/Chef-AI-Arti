'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, DietType } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import QuickActions from '@/components/QuickActions/QuickActions';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';

interface HomeClientProps {
  initialRecipes: Recipe[];
  userName: string | null;
  subscriptionStatus: 'free' | 'paid';
  initialIsVrat: boolean;
  isAuthenticated: boolean;
  dietType: DietType | null;
  cookedCount: number;
}

const WEEKDAYS_HI = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];

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

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const n = name ? name.split(' ')[0] : '';
  const tail = n ? `, ${n}` : '';
  if (h >= 6 && h < 11) return `Subah ka namaskar${tail}! ☀️`;
  if (h >= 11 && h < 16) return `Dopahar mein kya bana rahi hain${tail}? 🍽️`;
  if (h >= 16 && h < 19) return `Chai ke saath kuch snack?${n ? ` ${n}` : ''} 🍵`;
  if (h >= 19 && h < 22) return `Dinner ka time ho gaya${tail}! 🌙`;
  return `Raat ka khaana soch rahi hain?${n ? ` ${n}` : ''} 🌛`;
}

function FeaturedCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const emoji = CATEGORY_EMOJI[recipe.category] ?? CATEGORY_EMOJI.default;
  const bg = CATEGORY_BG[recipe.category] ?? CATEGORY_BG.default;
  const totalMin = recipe.cook_time_minutes + recipe.prep_time_minutes;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-shrink-0 flex-col overflow-hidden rounded-2xl text-left transition-transform active:scale-95"
      style={{ width: 160, height: 180, background: '#FFFFFF', border: '1px solid var(--border)' }}
    >
      {/* Image — top 60% */}
      <div className="relative w-full" style={{ height: 108 }}>
        {recipe.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.thumbnail_url}
            alt={recipe.name_hinglish}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl" style={{ background: bg }}>
            {emoji}
          </div>
        )}
        {recipe.is_vrat_friendly && (
          <span
            className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#2D6A4F' }}
          >
            🕉️
          </span>
        )}
      </div>

      {/* Text — bottom 40% */}
      <div className="flex flex-1 flex-col justify-between px-2.5 py-2">
        <p
          className="font-semibold leading-tight text-[#1A1A1A]"
          style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {recipe.name_hinglish}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8B7355]">⏱ {totalMin} min</span>
          {recipe.rating_count >= 3 && (
            <span className="text-[11px] text-[#D97706]">⭐ {recipe.avg_rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function HomeClient({
  initialRecipes,
  userName,
  subscriptionStatus,
  initialIsVrat,
  isAuthenticated,
  dietType,
  cookedCount,
}: HomeClientProps) {
  const router = useRouter();
  const [isVrat, setIsVrat] = useState(initialIsVrat);
  const [vatLoading, setVatLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);

  // Time-based greeting — compute after mount to avoid hydration mismatch
  const [greet, setGreet] = useState<string>(`Namaskar${userName ? `, ${userName.split(' ')[0]}` : ''}! 🙏`);
  useEffect(() => {
    setGreet(greeting(userName));
  }, [userName]);

  const dayHi = WEEKDAYS_HI[new Date().getDay()];

  // Top 4 for "Aaj ke liye": vrat + diet filtered (non-veg/egg users see all).
  const featured = recipes
    .filter((r) => {
      if (isVrat && !r.is_vrat_friendly) return false;
      if (dietType === 'veg' && r.diet_type !== 'veg') return false;
      return true;
    })
    .slice(0, 4);

  async function onVratToggle() {
    setVatLoading(true);
    const res = await fetch('/api/users/vrat-toggle', { method: 'POST' });
    const data = await res.json();
    setIsVrat(data.is_vrat_mode);
    setVatLoading(false);
  }

  const showExploreTeaser = !isAuthenticated || cookedCount < 5;

  return (
    <PullToRefresh onRefresh={() => router.refresh()}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8DDD0] bg-white px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-[#1A1A1A]">{greet}</p>
          <p className="text-[13px] text-[#8B7355]">{dayHi} ka khaana</p>
        </div>
        {isAuthenticated && (
          <VratToggle isVrat={isVrat} onToggle={onVratToggle} loading={vatLoading} />
        )}
      </div>

      {/* Tappable search bar */}
      <button
        type="button"
        onClick={() => router.push('/search')}
        className="mx-3 mt-3 flex h-10 w-[calc(100%-24px)] items-center gap-2 rounded-full bg-[#FFF0E6] px-4 text-left"
      >
        <span className="text-[13px] text-[#8B7355]">🔍 Kuch bhi dhundho...</span>
      </button>

      {/* Quick actions */}
      <QuickActions />

      {/* Aaj ke liye — horizontal scroll of 4 */}
      <section className="mb-6 mt-2">
        <p className="px-4 text-[14px] font-bold text-[#C4621E]">🍽️ Aaj ke liye</p>
        {featured.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#8B7355]">Koi recipe nahi mili 😕</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
            {featured.map((r) => (
              <FeaturedCard key={r.id} recipe={r} onClick={() => router.push('/recipe/' + r.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Aapki Chef Arti promo */}
      <button
        type="button"
        onClick={() => router.push('/chat')}
        className="mx-4 mb-6 flex w-[calc(100%-32px)] items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
        style={{ background: '#FFF0E6' }}
      >
        <span className="text-[36px] leading-none">🍳</span>
        <div>
          <p className="text-[14px] font-semibold text-[#1A1A1A]">Koi sawaal? Arti se poochho!</p>
          <p className="text-[13px] text-[#8B7355]">Khaana pakane mein help milegi 💬</p>
        </div>
      </button>

      {/* Naye Recipes explore teaser */}
      {showExploreTeaser && (
        <button
          type="button"
          onClick={() => router.push('/search')}
          className="mx-4 flex w-[calc(100%-32px)] items-center justify-between rounded-2xl bg-white px-4 py-3 text-left"
          style={{ border: '1px solid #E8640C' }}
        >
          <span className="text-[14px] font-semibold text-[#1A1A1A]">🍲 100+ recipes explore karo</span>
          <span className="text-[16px] text-[#E8640C]">→</span>
        </button>
      )}

      <div className="pb-24" />

      {/* Floating AI chat — auth-only, general context */}
      {isAuthenticated && (
        <FloatingChatButton subscriptionStatus={subscriptionStatus} />
      )}
    </PullToRefresh>
  );
}
