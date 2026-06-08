'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import RecipeCard from '@/components/RecipeCard/RecipeCard';

interface HomeClientProps {
  initialRecipes: Recipe[];
  userName: string | null;
  subscriptionStatus: 'free' | 'paid';
  initialIsVrat: boolean;
  isAuthenticated: boolean;
}

const WEEKDAYS_HI = [
  'Ravivar',
  'Somvar',
  'Mangalvar',
  'Budhvar',
  'Guruvar',
  'Shukravar',
  'Shanivar',
];

export default function HomeClient({
  initialRecipes,
  userName,
  subscriptionStatus,
  initialIsVrat,
  isAuthenticated,
}: HomeClientProps) {
  const router = useRouter();
  const [isVrat, setIsVrat] = useState(initialIsVrat);
  const [vatLoading, setVatLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);

  const dayHi = WEEKDAYS_HI[new Date().getDay()];

  const displayedRecipes = isVrat ? recipes.filter((r) => r.is_vrat_friendly) : recipes;

  async function onVratToggle() {
    setVatLoading(true);
    const res = await fetch('/api/users/vrat-toggle', { method: 'POST' });
    const data = await res.json();
    setIsVrat(data.is_vrat_mode);
    setVatLoading(false);
  }

  async function onSurprise() {
    const res = await fetch('/api/recipes/surprise');
    if (res.ok) {
      const data = await res.json();
      router.push('/recipe/' + data.recipe.id);
    }
  }

  return (
    <>
      {/* A. Header bar */}
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

      {/* B. Quick action strip */}
      <div className="flex gap-2 bg-[#FFF0E6] px-3 py-2">
        <button
          type="button"
          onClick={() => router.push('/fridge')}
          className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E8DDD0] bg-white text-[13px] font-medium text-[#1A1A1A]"
        >
          📷 Fridge Scan
        </button>
        <button
          type="button"
          onClick={onSurprise}
          className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E8DDD0] bg-white text-[13px] font-medium text-[#1A1A1A]"
        >
          🎲 Surprise karo!
        </button>
      </div>

      {/* C. Recipe list */}
      <div className="flex flex-col gap-2 px-3 py-2">
        {displayedRecipes.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#8B7355]">
            Koi recipe nahi mili. Thodi der mein aayenge! 🙏
          </p>
        ) : (
          displayedRecipes.map((r, index) => (
            <div key={r.id}>
              <RecipeCard
                recipe={r}
                onClick={() => router.push('/recipe/' + r.id)}
              />
              {index === 9 && subscriptionStatus === 'free' && (
                <div className="mt-2 rounded-xl border-2 border-[#E8640C] bg-[#FFF0E6] px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    Aur recipes dekhne ke liye Premium lo! 🍳
                  </p>
                  <p className="mt-0.5 text-xs text-[#8B7355]">
                    ₹150/mahine — unlimited recipes + chat
                  </p>
                  <button className="mt-2 h-9 w-full rounded-lg bg-[#E8640C] text-sm font-medium text-white">
                    Abhi lo →
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
