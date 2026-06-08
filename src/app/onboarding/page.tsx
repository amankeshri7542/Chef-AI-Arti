'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DietType } from '@/types/index';

const DIET_OPTIONS: { value: DietType; emoji: string; label: string; sub: string }[] = [
  { value: 'veg', emoji: '🥦', label: 'Shakahari', sub: 'Sirf veg khate hain' },
  { value: 'eggetarian', emoji: '🥚', label: 'Egg bhi chalega', sub: 'Veg + anda' },
  { value: 'non-veg', emoji: '🍗', label: 'Non-veg', sub: 'Sab chalega' },
];

const REGION_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: 'UP-Bihar', emoji: '🏛️', label: 'Uttar Pradesh / Bihar' },
  { value: 'Delhi-NCR', emoji: '🌆', label: 'Delhi / NCR' },
  { value: 'Punjab-Haryana', emoji: '🌾', label: 'Punjab / Haryana' },
  { value: 'Rajasthan-MP', emoji: '🏔️', label: 'Rajasthan / MP' },
  { value: 'other', emoji: '🗺️', label: 'Kuch aur jagah' },
];

const FAMILY_SIZE_OPTIONS = [2, 4, 6, 8];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [diet, setDiet] = useState<DietType | null>(null);
  const [preferredRegion, setPreferredRegion] = useState<string | null>(null);
  const [familySize, setFamilySize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    if (!diet || !familySize) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diet_type: diet,
          preferred_region: preferredRegion ?? 'other',
          family_size: familySize,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      router.push('/home');
    } catch {
      setError('Kuch gadbad hui, dobara try karein');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9] px-6 py-10">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {([1, 2, 3] as const).map((s) => (
          <span
            key={s}
            className={`h-2 rounded-full transition-all ${
              s === step ? 'w-6 bg-[#E8640C]' : s < step ? 'w-2 bg-[#E8640C]/40' : 'w-2 bg-[#E8DDD0]'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* Step 1 — Diet */}
      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Aap kya khaate hain?</h2>
          <p className="mt-1 text-sm text-[#8B7355]">Isse recipes aapke liye filter hogi</p>

          <div className="mt-6 flex flex-col gap-3">
            {DIET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDiet(opt.value)}
                className={`flex min-h-[64px] items-center gap-4 rounded-xl border px-4 text-left transition-colors ${
                  diet === opt.value
                    ? 'border-[#E8640C] bg-[#FFF0E6]'
                    : 'border-[#E8DDD0] bg-white'
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span>
                  <p className="font-medium text-[#1A1A1A]">{opt.label}</p>
                  <p className="text-xs text-[#8B7355]">{opt.sub}</p>
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!diet}
            className="mt-auto flex h-12 w-full items-center justify-center rounded-xl bg-[#E8640C] font-medium text-white disabled:opacity-40"
          >
            Aage barhein →
          </button>
        </div>
      )}

      {/* Step 2 — Region */}
      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Aap kahan se hain?</h2>
          <p className="mt-1 text-sm text-[#8B7355]">Aapke ilaake ka khaana suggest karein</p>

          <div className="mt-6 flex flex-col gap-3">
            {REGION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPreferredRegion(opt.value)}
                className={`flex min-h-[56px] items-center gap-4 rounded-xl border px-4 text-left transition-colors ${
                  preferredRegion === opt.value
                    ? 'border-[#E8640C] bg-[#FFF0E6]'
                    : 'border-[#E8DDD0] bg-white'
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="font-medium text-[#1A1A1A]">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[#E8DDD0] text-[#8B7355]"
            >
              ← Wapas
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!preferredRegion}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#E8640C] font-medium text-white disabled:opacity-40"
            >
              Aage barhein →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Family size */}
      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Ghar mein kitne log hain?</h2>
          <p className="mt-1 text-sm text-[#8B7355]">Ingredients ki matra isi hisaab se hogi</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {FAMILY_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => setFamilySize(size)}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border transition-colors ${
                  familySize === size
                    ? 'border-[#E8640C] bg-[#FFF0E6]'
                    : 'border-[#E8DDD0] bg-white'
                }`}
              >
                <span className="text-2xl font-semibold text-[#1A1A1A]">{size}</span>
                <span className="text-xs text-[#8B7355]">
                  {size === 2 ? 'Do log' : size === 4 ? 'Char log' : size === 6 ? 'Chhe log' : '8+ log'}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-auto flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[#E8DDD0] text-[#8B7355]"
            >
              ← Wapas
            </button>
            <button
              onClick={finish}
              disabled={!familySize || loading}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#E8640C] font-medium text-white disabled:opacity-40"
            >
              {loading ? 'Thoda ruko…' : 'Shuru karein 🎉'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
