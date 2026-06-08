'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import RecipeCardGrid from '@/components/RecipeCard/RecipeCardGrid';
import QuickActions from '@/components/QuickActions/QuickActions';

interface HomeClientProps {
  initialRecipes: Recipe[];
  userName: string | null;
  subscriptionStatus: 'free' | 'paid';
  initialIsVrat: boolean;
  isAuthenticated: boolean;
}

const WEEKDAYS_HI = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];

const CATEGORY_CHIPS = [
  { label: '🥗 Sabzi', filter: 'sabzi' },
  { label: '🫘 Dal', filter: 'dal' },
  { label: '🍚 Chawal', filter: 'chawal' },
  { label: '🍳 Nashta', filter: 'nashta' },
  { label: '🕉️ Vrat', filter: 'vrat' },
];

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

export default function HomeClient({ initialRecipes, userName, subscriptionStatus, initialIsVrat, isAuthenticated }: HomeClientProps) {
  const router = useRouter();
  const [isVrat, setIsVrat] = useState(initialIsVrat);
  const [vatLoading, setVatLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Time-based greeting — compute after mount to avoid hydration mismatch
  const [greet, setGreet] = useState<string>(`Namaskar${userName ? `, ${userName.split(' ')[0]}` : ''}! 🙏`);
  useEffect(() => {
    setGreet(greeting(userName));
  }, [userName]);

  const dayHi = WEEKDAYS_HI[new Date().getDay()];

  const displayedRecipes = recipes.filter((r) => {
    if (isVrat && !r.is_vrat_friendly) return false;
    if (categoryFilter === 'vrat') return r.is_vrat_friendly;
    if (categoryFilter && r.category !== categoryFilter) return false;
    return true;
  });

  async function onVratToggle() {
    setVatLoading(true);
    const res = await fetch('/api/users/vrat-toggle', { method: 'POST' });
    const data = await res.json();
    setIsVrat(data.is_vrat_mode);
    setVatLoading(false);
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8DDD0] bg-white px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-[#1A1A1A]">
            {greet}
          </p>
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

      {/* Quick actions + category chips — single horizontal-scroll row */}
      <div className="flex items-stretch gap-3 overflow-x-auto px-3 py-2 scrollbar-hide">
        <QuickActions inline />
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = categoryFilter === chip.filter;
          return (
            <button
              key={chip.filter}
              type="button"
              onClick={() => setCategoryFilter(isActive ? null : chip.filter)}
              className="flex flex-shrink-0 items-center self-center rounded-[20px] px-4 text-[13px] font-medium"
              style={{
                minHeight: 52,
                background: isActive ? '#E8640C' : '#FFFFFF',
                border: isActive ? '1px solid #E8640C' : '1px solid var(--border)',
                color: isActive ? '#FFFFFF' : 'var(--muted)',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-2 gap-0.5 px-0.5 pb-24">
        {displayedRecipes.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-sm text-[#8B7355]">
            Koi recipe nahi mili 😕
          </div>
        ) : (
          displayedRecipes.map((r, index) => {
            const isFeatured = index % 5 === 4;
            const delay = index <= 7 ? index * 60 : 0;
            return (
              <div
                key={r.id}
                className={`animate-card-entry ${isFeatured ? 'col-span-2' : ''}`}
                style={{
                  animationDelay: `${delay}ms`,
                  ...(isFeatured ? { aspectRatio: '2/1' } : {}),
                }}
              >
                <RecipeCardGrid recipe={r} onClick={() => router.push('/recipe/' + r.id)} />
              </div>
            );
          })
        )}
        {displayedRecipes.length >= 10 && subscriptionStatus === 'free' && (
          <div className="col-span-2 mx-2 mt-2 rounded-xl border-2 border-[#E8640C] bg-[#FFF0E6] px-4 py-3 text-center">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">Aur recipes dekhne ke liye Premium lo! 🍳</p>
            <p className="mt-0.5 text-[13px] text-[#8B7355]">₹150/mahine — unlimited recipes + chat</p>
            <button className="mt-2 h-[52px] w-full rounded-lg bg-[#E8640C] text-[14px] font-medium text-white">Abhi lo →</button>
          </div>
        )}
      </div>
    </>
  );
}
