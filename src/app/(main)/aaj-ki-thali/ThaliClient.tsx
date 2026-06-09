'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';
import RecipeCardCompact from '@/components/RecipeCard/RecipeCardCompact';
import BackButton from '@/components/BackButton/BackButton';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';

interface ThaliData {
  nashta: Recipe | null;
  dopahar: Recipe | null;
  raat: Recipe | null;
}

const MEAL_SLOTS = [
  { key: 'nashta' as const, label: '🌅 Nashta', time: 'Subah' },
  { key: 'dopahar' as const, label: '☀️ Dopahar', time: 'Lunch' },
  { key: 'raat' as const, label: '🌙 Raat', time: 'Dinner' },
];

export default function ThaliClient() {
  const router = useRouter();
  const [thali, setThali] = useState<ThaliData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchThali() {
    setLoading(true);
    try {
      const res = await fetch('/api/thali/suggest');
      if (res.ok) {
        const data = await res.json();
        setThali(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchThali();
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#E8DDD0] bg-white px-4 py-3">
        <BackButton fallback="/home" className="bg-[#FFF0E6] text-[#5C3D1E]" />
        <div>
          <p className="text-[15px] font-bold text-[#1A1A1A]">🍱 Aaj ki Thali</p>
          <p className="text-[11px] text-[#8B7355]">Aaj ke teeno waqt ka khaana</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-6">
        {loading ? (
          <ArtiLoader className="py-16" message="Aaj ki thali soch rahi hai" />
        ) : (
          <div className="animate-content-fade flex flex-col gap-6">
            {MEAL_SLOTS.map((slot) => {
              const recipe = thali?.[slot.key] ?? null;
              return (
                <section key={slot.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[14px] font-bold text-[#C4621E]">{slot.label}</span>
                    <span className="text-[11px] text-[#8B7355]">{slot.time}</span>
                  </div>
                  {recipe ? (
                    <RecipeCardCompact
                      recipe={recipe}
                      onClick={() => router.push(`/recipe/${recipe.id}`)}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E8DDD0] bg-[#FFF8F0] px-4 py-6 text-center">
                      <p className="text-[13px] text-[#8B7355]">
                        Koi recipe nahi mili — khud choose karein →
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/search')}
                        className="mt-2 rounded-full bg-[#E8640C] px-4 py-2 text-[12px] font-semibold text-white"
                        style={{ minHeight: 40 }}
                      >
                        Browse karein
                      </button>
                    </div>
                  )}
                </section>
              );
            })}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 mt-2">
              <button
                type="button"
                onClick={fetchThali}
                className="flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold"
                style={{ background: '#FFF0E6', color: '#E8640C', border: '1px solid #E8DDD0' }}
              >
                🔄 Phir se suggest karo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
