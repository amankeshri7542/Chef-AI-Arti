'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import RecipeCardGrid from '@/components/RecipeCard/RecipeCardGrid';
import StoryCircles from '@/components/StoryCircles/StoryCircles';
import QuickActions from '@/components/QuickActions/QuickActions';

interface HomeClientProps {
  initialRecipes: Recipe[];
  userName: string | null;
  subscriptionStatus: 'free' | 'paid';
  initialIsVrat: boolean;
  isAuthenticated: boolean;
}

const WEEKDAYS_HI = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];

export default function HomeClient({ initialRecipes, userName, subscriptionStatus, initialIsVrat, isAuthenticated }: HomeClientProps) {
  const router = useRouter();
  const [isVrat, setIsVrat] = useState(initialIsVrat);
  const [vatLoading, setVatLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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
            Namaskar{userName ? `, ${userName.split(' ')[0]}` : ''}! 🙏
          </p>
          <p className="text-[10px] text-[#8B7355]">{dayHi} ka khaana</p>
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

      {/* Story circles */}
      <StoryCircles onFilter={setCategoryFilter} />

      {/* Quick actions */}
      <QuickActions />

      {/* 2-col grid */}
      <div className="grid grid-cols-2 gap-0.5 px-0.5 pb-24">
        {displayedRecipes.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-sm text-[#8B7355]">
            Koi recipe nahi mili 😕
          </div>
        ) : (
          displayedRecipes.map((r, index) => {
            const isFeatured = index % 5 === 4;
            return (
              <div key={r.id} className={isFeatured ? 'col-span-2' : ''} style={isFeatured ? { aspectRatio: '2/1' } : {}}>
                <RecipeCardGrid recipe={r} onClick={() => router.push('/recipe/' + r.id)} />
              </div>
            );
          })
        )}
        {displayedRecipes.length >= 10 && subscriptionStatus === 'free' && (
          <div className="col-span-2 mx-2 mt-2 rounded-xl border-2 border-[#E8640C] bg-[#FFF0E6] px-4 py-3 text-center">
            <p className="text-sm font-semibold text-[#1A1A1A]">Aur recipes dekhne ke liye Premium lo! 🍳</p>
            <p className="mt-0.5 text-xs text-[#8B7355]">₹150/mahine — unlimited recipes + chat</p>
            <button className="mt-2 h-9 w-full rounded-lg bg-[#E8640C] text-sm font-medium text-white">Abhi lo →</button>
          </div>
        )}
      </div>
    </>
  );
}
