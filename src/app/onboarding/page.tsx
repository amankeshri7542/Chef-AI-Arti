'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DietType } from '@/types/index';

const DIET_OPTIONS: { value: DietType; emoji: string; label: string; sub: string }[] = [
  { value: 'veg', emoji: '🥦', label: 'Pure Veg', sub: 'Hara-bhara khaana' },
  { value: 'eggetarian', emoji: '🥚', label: 'Egg bhi chalti hai', sub: 'Veg + anda' },
  { value: 'non-veg', emoji: '🍗', label: 'Non-veg bhi banta hai', sub: 'Sab chalega' },
];

const REGION_OPTIONS: { value: string; emoji: string; label: string; dot: string }[] = [
  { value: 'UP-Bihar', emoji: '🏛️', label: 'Uttar Pradesh / Bihar', dot: 'var(--saffron)' },
  { value: 'Delhi-NCR', emoji: '🌆', label: 'Delhi / NCR', dot: '#D64545' },
  { value: 'Punjab-Haryana', emoji: '🌾', label: 'Punjab / Haryana', dot: 'var(--green)' },
  { value: 'Rajasthan-MP', emoji: '🏔️', label: 'Rajasthan / MP', dot: '#C4621E' },
  { value: 'other', emoji: '🗺️', label: 'Kuch aur jagah', dot: 'var(--muted)' },
];

const FAMILY_SIZE_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 2, emoji: '👤👤', label: '1-2 log' },
  { value: 4, emoji: '👨‍👩‍👧', label: '3-5 log' },
  { value: 6, emoji: '👨‍👩‍👧‍👦', label: '6+ log' },
];

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [diet, setDiet] = useState<DietType | null>(null);
  const [preferredRegion, setPreferredRegion] = useState<string | null>(null);
  const [familySize, setFamilySize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-advance the welcome screen after 2.5s
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => setStep(1), 2500);
    return () => clearTimeout(t);
  }, [step]);

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
      router.push('/onboarding/done');
    } catch {
      setError('Kuch gadbad hui, dobara try karein');
      setLoading(false);
    }
  }

  // ───────── STEP 0 — Welcome ─────────
  if (step === 0) {
    return (
      <div
        className="flex min-h-screen flex-col items-center px-6 py-12"
        style={{ background: 'var(--cream)' }}
      >
        {/* Floating food emojis */}
        <div className="flex items-end justify-center gap-6" style={{ height: 64 }}>
          {[
            { e: '🥔', d: 0 },
            { e: '🍅', d: 200 },
            { e: '🧅', d: 400 },
          ].map(({ e, d }) => (
            <span
              key={e}
              style={{
                fontSize: 32,
                animation: 'floatUp 2s ease-in-out infinite alternate',
                animationDelay: `${d}ms`,
              }}
            >
              {e}
            </span>
          ))}
        </div>

        {/* Middle */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span style={{ fontSize: 48 }}>🍳</span>
          <h1
            className="font-display mt-4"
            style={{ fontSize: 24, color: 'var(--terracotta)' }}
          >
            Aapki apni Chef Arti
          </h1>
          <p
            className="mt-3"
            style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 240, lineHeight: 1.5 }}
          >
            3 chhote sawaal — aur hum jaanenge aap aur aapka parivar kya pasand karta hai
          </p>
        </div>

        {/* Bottom CTA */}
        <button
          onClick={() => setStep(1)}
          className="w-full font-display transition-transform active:scale-[0.97]"
          style={{
            height: 56,
            borderRadius: 16,
            background: 'var(--saffron)',
            color: '#fff',
            fontSize: 18,
            boxShadow: '0 4px 20px var(--shadow)',
          }}
        >
          Shuru karein →
        </button>

        {/* Progress dots */}
        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3].map((d) => (
            <span
              key={d}
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                background: d === 1 ? 'var(--saffron)' : 'transparent',
                border: d === 1 ? 'none' : '1.5px solid var(--border)',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ───────── STEPS 1-3 — Questions ─────────
  return (
    <div
      className="flex min-h-screen flex-col px-6 py-10"
      style={{ background: 'var(--cream)' }}
    >
      {/* Progress dots */}
      <div className="mb-8 flex justify-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <span
            key={s}
            className="h-2 rounded-full transition-all"
            style={{
              width: s === step ? 24 : 8,
              background:
                s === step
                  ? 'var(--saffron)'
                  : s < step
                    ? 'var(--saffron-dk)'
                    : 'var(--border)',
              opacity: s < step ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg px-4 py-3"
          style={{ fontSize: 13, background: '#FDEAEA', color: '#B42318' }}
        >
          {error}
        </p>
      )}

      {/* Step 1 — Diet */}
      {step === 1 && (
        <div key="q1" className="page-enter flex flex-1 flex-col">
          <h2 className="font-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>
            Aap kya khaate hain?
          </h2>
          <p className="mt-1" style={{ fontSize: 14, color: 'var(--muted)' }}>
            Isse recipes aapke liye filter hogi
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {DIET_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={diet === opt.value}
                onClick={() => setDiet(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <span>
                  <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>{opt.sub}</p>
                </span>
              </OptionCard>
            ))}
          </div>

          <NextButton
            onClick={() => setStep(2)}
            disabled={!diet}
            count="1 / 3"
          />
        </div>
      )}

      {/* Step 2 — Family size */}
      {step === 2 && (
        <div key="q2" className="page-enter flex flex-1 flex-col">
          <h2 className="font-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>
            Ghar mein kitne log hain?
          </h2>
          <p className="mt-1" style={{ fontSize: 14, color: 'var(--muted)' }}>
            Ingredients ki matra isi hisaab se hogi
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {FAMILY_SIZE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={familySize === opt.value}
                onClick={() => setFamilySize(opt.value)}
              >
                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>

          <div className="mt-auto flex gap-3 pt-6">
            <BackButton onClick={() => setStep(1)} />
            <NextButton onClick={() => setStep(3)} disabled={!familySize} count="2 / 3" />
          </div>
        </div>
      )}

      {/* Step 3 — Region */}
      {step === 3 && (
        <div key="q3" className="page-enter flex flex-1 flex-col">
          <h2 className="font-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>
            Aap kahan se hain?
          </h2>
          <p className="mt-1" style={{ fontSize: 14, color: 'var(--muted)' }}>
            Aapke ilaake ka khaana suggest karein
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {REGION_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={preferredRegion === opt.value}
                onClick={() => setPreferredRegion(opt.value)}
              >
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <span
                  className="rounded-full"
                  style={{ width: 10, height: 10, background: opt.dot, flexShrink: 0 }}
                />
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>

          <div className="mt-auto flex gap-3 pt-6">
            <BackButton onClick={() => setStep(2)} />
            <button
              onClick={finish}
              disabled={!preferredRegion || loading}
              className="font-display flex flex-1 items-center justify-center transition-transform active:scale-[0.97] disabled:opacity-40"
              style={{
                minHeight: 56,
                borderRadius: 16,
                background: 'var(--saffron)',
                color: '#fff',
                fontSize: 16,
                boxShadow: '0 4px 20px var(--shadow)',
              }}
            >
              {loading ? 'Thoda ruko…' : 'Ho gaya 🎉  ·  3 / 3'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Reusable sub-components ─────────

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap-spring relative flex items-center gap-4 text-left ${selected ? 'scale-[1.02]' : ''}`}
      style={{
        minHeight: 64,
        padding: '16px 20px',
        borderRadius: 16,
        border: selected ? '2px solid var(--saffron)' : '2px solid var(--border)',
        background: selected ? 'var(--saffron-lt)' : '#fff',
        boxShadow: selected ? '0 6px 18px var(--shadow)' : '0 2px 8px rgba(180,80,20,0.05)',
        transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {children}
      {selected && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            background: 'var(--saffron)',
            color: '#fff',
            fontSize: 13,
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

function NextButton({
  onClick,
  disabled,
  count,
}: {
  onClick: () => void;
  disabled: boolean;
  count: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-display mt-auto flex w-full items-center justify-center transition-transform active:scale-[0.97] disabled:opacity-40"
      style={{
        minHeight: 56,
        borderRadius: 16,
        background: 'var(--saffron)',
        color: '#fff',
        fontSize: 16,
        boxShadow: '0 4px 20px var(--shadow)',
      }}
    >
      Aage →&nbsp;&nbsp;·&nbsp;&nbsp;{count}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center transition-transform active:scale-[0.97]"
      style={{
        minHeight: 56,
        minWidth: 56,
        paddingInline: 20,
        borderRadius: 16,
        border: '2px solid var(--border)',
        background: '#fff',
        color: 'var(--muted)',
        fontSize: 15,
      }}
    >
      ← Wapas
    </button>
  );
}
