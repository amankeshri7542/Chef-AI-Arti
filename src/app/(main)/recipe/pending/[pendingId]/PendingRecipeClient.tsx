'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton/BackButton';
import type { GeneratedRecipe } from '@/lib/generate-recipe';

interface CookResult {
  promoted?: boolean;
  recipeId?: string;
  cooksNeeded?: number;
  alreadyCooked?: boolean;
}

interface Props {
  pendingId: string;
  recipe: GeneratedRecipe;
  cookedCount: number;
  status: string;
}

export default function PendingRecipeClient({ pendingId, recipe }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCooked() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/pending/${pendingId}/cook`, {
        method: 'POST',
      });
      if (!res.ok && res.status !== 200) {
        setError('Kuch gadbad ho gayi, dobara try karein');
        setLoading(false);
        return;
      }
      const data: CookResult = await res.json();
      setResult(data);
    } catch {
      setError('Kuch gadbad ho gayi, dobara try karein');
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9] px-4 py-4 pb-32">
      <div className="mb-3">
        <BackButton fallback="/home" className="bg-[#FFF0E6] text-[#5C3D1E]" />
      </div>

      {/* New-recipe banner */}
      <div
        className="rounded-2xl border px-4 py-3"
        style={{ background: '#FEF3C7', borderColor: '#FBBF24' }}
      >
        <p className="text-[15px] font-bold text-[#1A1A1A]">✨ Naya Recipe</p>
        <p className="mt-0.5 text-[12px] text-[#8B7355]">
          Arti ne yeh aapke liye banaya — try karke batao!
        </p>
      </div>

      {/* Name + description */}
      <h1 className="mt-5 text-[22px] font-bold leading-tight text-[#1A1A1A]">
        {recipe.name_hinglish}
      </h1>
      {recipe.description && (
        <p className="mt-1.5 text-[13px] text-[#8B7355]">{recipe.description}</p>
      )}

      {recipe.cook_time_minutes > 0 && (
        <p className="mt-2 text-[13px] font-medium text-[#E8640C]">
          ⏱ {recipe.cook_time_minutes} min
        </p>
      )}

      {/* Ingredients */}
      <section className="mt-6">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">Saamaan 🧺</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {recipe.ingredients.map((ing, i) => (
            <li
              key={`${ing.name}-${i}`}
              className="flex items-center justify-between rounded-xl border border-[#E8DDD0] bg-white px-3 py-2.5"
            >
              <span className="text-[14px] text-[#1A1A1A]">{ing.name}</span>
              <span className="text-[13px] text-[#8B7355]">{ing.qty_desi}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section className="mt-6">
        <h2 className="text-[16px] font-bold text-[#1A1A1A]">Banane ka tarika 👩‍🍳</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {[...recipe.steps]
            .sort((a, b) => a.step - b.step)
            .map((s) => (
              <li
                key={s.step}
                className="flex gap-3 rounded-xl border border-[#E8DDD0] bg-white px-3 py-3"
              >
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: '#E8640C' }}
                >
                  {s.step}
                </span>
                <div className="flex-1">
                  <p className="text-[14px] leading-snug text-[#1A1A1A]">
                    {s.instruction}
                  </p>
                  {s.time_minutes > 0 && (
                    <p className="mt-1 text-[11px] text-[#8B7355]">{s.time_minutes} min</p>
                  )}
                </div>
              </li>
            ))}
        </ol>
      </section>

      {/* Cook action / result */}
      <section className="mt-8">
        {!result ? (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleCooked}
              className="flex h-14 w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: '#2D6A4F' }}
            >
              {loading ? 'Ruko zara...' : 'Bana liya! ✅'}
            </button>
            {error && (
              <p className="mt-3 text-center text-[13px] text-[#BF4E06]">{error}</p>
            )}
          </>
        ) : result.alreadyCooked ? (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4 text-center">
            <p className="text-[14px] text-[#1A1A1A]">
              Aap pehle hi bana chuke ho 😊
            </p>
          </div>
        ) : result.promoted ? (
          <div
            className="rounded-2xl border px-4 py-4 text-center"
            style={{ background: '#FEF3C7', borderColor: '#FBBF24' }}
          >
            <p className="text-[15px] font-bold text-[#1A1A1A]">
              Mubarak ho! Yeh recipe ab sabke liye library mein aa gayi 🎉
            </p>
            {result.recipeId && (
              <button
                type="button"
                onClick={() => router.push('/recipe/' + result.recipeId)}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-xl text-[14px] font-bold text-white"
                style={{ background: '#E8640C' }}
              >
                Library mein dekho →
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4 text-center">
            <p className="text-[14px] text-[#1A1A1A]">
              {result.cooksNeeded && result.cooksNeeded > 0
                ? `${result.cooksNeeded} aur log isko banayein toh yeh library mein aa jaayega! 🎉`
                : 'Bas thoda aur — yeh library mein aane hi waali hai! 🎉'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
