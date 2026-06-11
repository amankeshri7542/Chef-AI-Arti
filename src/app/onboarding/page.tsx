'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type {
  CookingFor,
  CookingSkill,
  DietType,
  SpiceLevel,
  TimePreference,
} from '@/types/index';

// ───────── Option data ─────────

const COOKING_FOR_OPTIONS: { value: CookingFor; emoji: string; label: string }[] = [
  { value: 'alone', emoji: '👤', label: 'Sirf apne liye' },
  { value: 'couple', emoji: '👫', label: 'Do log hain' },
  { value: 'family', emoji: '👨‍👩‍👧', label: 'Parivar ke liye' },
  { value: 'pg', emoji: '🏠', label: 'PG / Hostel' },
];

const DIET_OPTIONS: { value: DietType; emoji: string; label: string }[] = [
  { value: 'veg', emoji: '🥬', label: 'Pure Veg' },
  { value: 'eggetarian', emoji: '🍳', label: 'Egg bhi chalta hai' },
  { value: 'non-veg', emoji: '🍗', label: 'Non-veg bhi' },
  { value: 'vegan', emoji: '🌱', label: 'Vegan' },
  { value: 'jain', emoji: '🙏', label: 'Jain' },
];

const REGION_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: 'Punjab-Haryana', emoji: '🌾', label: 'Punjab / Haryana' },
  { value: 'UP-Bihar', emoji: '🏛️', label: 'UP / Bihar' },
  { value: 'Delhi-NCR', emoji: '🌆', label: 'Delhi / NCR' },
  { value: 'Rajasthan-MP', emoji: '🏔️', label: 'Rajasthan / MP' },
  { value: 'south-indian', emoji: '🥥', label: 'South Indian' },
  { value: 'bengali', emoji: '🐟', label: 'Bengali' },
  { value: 'gujarati', emoji: '🥣', label: 'Gujarati' },
  { value: 'maharashtrian', emoji: '🌶️', label: 'Maharashtrian' },
  { value: 'any', emoji: '🗺️', label: 'Sab chalega!' },
];

// UI keeps 4 spice options; 'very-hot' maps to 'hot' at save time
// (users.spice_preference only allows mild | medium | hot).
type SpiceChoice = 'mild' | 'medium' | 'hot' | 'very-hot';
const SPICE_OPTIONS: { value: SpiceChoice; emoji: string; label: string }[] = [
  { value: 'mild', emoji: '🧊', label: 'Bilkul halka' },
  { value: 'medium', emoji: '🌶', label: 'Thoda sa' },
  { value: 'hot', emoji: '🔥', label: 'Achha teekha' },
  { value: 'very-hot', emoji: '💀', label: 'Jitna ho sake!' },
];

const SKILL_OPTIONS: { value: CookingSkill; emoji: string; label: string }[] = [
  { value: 'beginner', emoji: '🙂', label: 'Naya seekh raha/rahi hoon' },
  { value: 'intermediate', emoji: '👨‍🍳', label: 'Theek-thaak aata hai' },
  { value: 'expert', emoji: '🔥', label: 'Kaafi expert hoon' },
];

const TIME_OPTIONS: { value: TimePreference; emoji: string; label: string }[] = [
  { value: '15min', emoji: '⚡', label: '15 minute mein taiyaar' },
  { value: '30min', emoji: '⏰', label: '30 minute tak theek hai' },
  { value: 'any', emoji: '🍲', label: 'Time ki koi dikkat nahi' },
];

const KITCHEN_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: 'gas-stove', emoji: '🔥', label: 'Gas Stove' },
  { value: 'induction', emoji: '⚡', label: 'Induction' },
  { value: 'microwave', emoji: '📡', label: 'Microwave' },
  { value: 'air-fryer', emoji: '💨', label: 'Air Fryer' },
  { value: 'pressure-cooker', emoji: '🥘', label: 'Pressure Cooker' },
];
const ALL_KITCHEN = KITCHEN_OPTIONS.map((o) => o.value);

const TOTAL_STEPS = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = welcome, 1..7 = questions
  const [cookingFor, setCookingFor] = useState<CookingFor | null>(null);
  const [diet, setDiet] = useState<DietType | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [spice, setSpice] = useState<SpiceChoice | null>(null);
  const [skill, setSkill] = useState<CookingSkill | null>(null);
  const [timePref, setTimePref] = useState<TimePreference | null>(null);
  const [kitchen, setKitchen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-advance the welcome screen after 2.5s
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => setStep(1), 2500);
    return () => clearTimeout(t);
  }, [step]);

  function toggleKitchen(value: string) {
    setKitchen((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function finish() {
    if (!cookingFor || !diet || !region || !spice || !skill || !timePref) return;
    setLoading(true);
    setError('');
    try {
      const spiceToSave: SpiceLevel = spice === 'very-hot' ? 'hot' : spice;
      const res = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooking_for: cookingFor,
          diet_type: diet,
          preferred_region: region,
          spice_preference: spiceToSave,
          cooking_skill: skill,
          time_preference: timePref,
          kitchen_setup: kitchen,
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
            7 chhote sawaal — aur hum jaanenge aapki rasoi aur aapka swad
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
        <ProgressDots current={1} className="mt-6" />
      </div>
    );
  }

  // ───────── STEPS 1-7 — Questions ─────────
  return (
    <div
      className="flex min-h-screen flex-col px-6 py-10"
      style={{ background: 'var(--cream)' }}
    >
      <ProgressDots current={step} className="mb-8" />

      {error && (
        <p
          className="mb-4 rounded-lg px-4 py-3"
          style={{ fontSize: 13, background: '#FDEAEA', color: '#B42318' }}
        >
          {error}
        </p>
      )}

      {/* Q1 — Cooking for */}
      {step === 1 && (
        <Question
          key="q1"
          title="Aap kis ke liye pakate hain?"
          sub="Ingredients ki matra isi hisaab se hogi"
        >
          <div className="flex flex-col gap-3">
            {COOKING_FOR_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={cookingFor === opt.value}
                onClick={() => setCookingFor(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <div className="mt-auto flex pt-6">
            <NextButton onClick={() => setStep(2)} disabled={!cookingFor} count="1 / 7" />
          </div>
        </Question>
      )}

      {/* Q2 — Diet */}
      {step === 2 && (
        <Question
          key="q2"
          title="Khaane mein kya chalega?"
          sub="Recipes isi hisaab se filter hongi"
        >
          <div className="flex flex-col gap-3">
            {DIET_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={diet === opt.value}
                onClick={() => setDiet(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <NavRow
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            disabled={!diet}
            count="2 / 7"
          />
        </Question>
      )}

      {/* Q3 — Region */}
      {step === 3 && (
        <Question
          key="q3"
          title="Kaunse ilaake ka swad pasand hai?"
          sub="Aapke pasand ka khaana pehle dikhega"
        >
          <div className="grid grid-cols-2 gap-3">
            {REGION_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={region === opt.value}
                onClick={() => setRegion(opt.value)}
                compact
              >
                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 13.5, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <NavRow
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            disabled={!region}
            count="3 / 7"
          />
        </Question>
      )}

      {/* Q4 — Spice */}
      {step === 4 && (
        <Question
          key="q4"
          title="Teekha kitna pasand hai?"
          sub="Mirch-masala aapke hisaab se"
        >
          <div className="flex flex-col gap-3">
            {SPICE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={spice === opt.value}
                onClick={() => setSpice(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <NavRow
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            disabled={!spice}
            count="4 / 7"
          />
        </Question>
      )}

      {/* Q5 — Skill */}
      {step === 5 && (
        <Question
          key="q5"
          title="Khaana banana kitna aata hai?"
          sub="Vidhi isi hisaab se samjhayenge"
        >
          <div className="flex flex-col gap-3">
            {SKILL_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={skill === opt.value}
                onClick={() => setSkill(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <NavRow
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
            disabled={!skill}
            count="5 / 7"
          />
        </Question>
      )}

      {/* Q6 — Time */}
      {step === 6 && (
        <Question
          key="q6"
          title="Kitna time hota hai usually?"
          sub="Jaldi waali ya aaram se banne waali recipes"
        >
          <div className="flex flex-col gap-3">
            {TIME_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={timePref === opt.value}
                onClick={() => setTimePref(opt.value)}
              >
                <span style={{ fontSize: 26 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 15, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
          </div>
          <NavRow
            onBack={() => setStep(5)}
            onNext={() => setStep(7)}
            disabled={!timePref}
            count="6 / 7"
          />
        </Question>
      )}

      {/* Q7 — Kitchen setup (multi-select) */}
      {step === 7 && (
        <Question
          key="q7"
          title="Rasoi mein kya kya hai?"
          sub="Jitne hain sab chunein"
        >
          <div className="grid grid-cols-2 gap-3">
            {KITCHEN_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={kitchen.includes(opt.value)}
                onClick={() => toggleKitchen(opt.value)}
                compact
              >
                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                <p className="font-medium" style={{ fontSize: 13.5, color: 'var(--text)' }}>
                  {opt.label}
                </p>
              </OptionCard>
            ))}
            <OptionCard
              selected={kitchen.length === ALL_KITCHEN.length}
              onClick={() => setKitchen([...ALL_KITCHEN])}
              compact
            >
              <span style={{ fontSize: 22 }}>✅</span>
              <p className="font-medium" style={{ fontSize: 13.5, color: 'var(--text)' }}>
                Sab kuch hai!
              </p>
            </OptionCard>
          </div>

          <div className="mt-auto flex gap-3 pt-6">
            <BackButton onClick={() => setStep(6)} />
            <button
              onClick={finish}
              disabled={kitchen.length === 0 || loading}
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
              {loading ? 'Thoda ruko…' : 'Ho gaya 🎉  ·  7 / 7'}
            </button>
          </div>
        </Question>
      )}
    </div>
  );
}

// ───────── Reusable sub-components ─────────

function ProgressDots({ current, className }: { current: number; className?: string }) {
  return (
    <div className={`flex justify-center gap-2 ${className ?? ''}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
        <span
          key={s}
          className="h-2 rounded-full transition-all"
          style={{
            width: s === current ? 24 : 8,
            background:
              s === current
                ? 'var(--saffron)'
                : s < current
                  ? 'var(--saffron-dk)'
                  : 'var(--border)',
            opacity: s < current ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  );
}

function Question({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in-up flex flex-1 flex-col">
      <h2 className="font-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>
        {title}
      </h2>
      <p className="mt-1 mb-6" style={{ fontSize: 14, color: 'var(--muted)' }}>
        {sub}
      </p>
      {children}
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  compact,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap-spring relative flex items-center text-left ${compact ? 'gap-2.5' : 'gap-4'} ${selected ? 'scale-[1.02]' : ''}`}
      style={{
        minHeight: compact ? 56 : 72,
        padding: compact ? '12px 14px' : '16px 20px',
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

function NavRow({
  onBack,
  onNext,
  disabled,
  count,
}: {
  onBack: () => void;
  onNext: () => void;
  disabled: boolean;
  count: string;
}) {
  return (
    <div className="mt-auto flex gap-3 pt-6">
      <BackButton onClick={onBack} />
      <NextButton onClick={onNext} disabled={disabled} count={count} />
    </div>
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
