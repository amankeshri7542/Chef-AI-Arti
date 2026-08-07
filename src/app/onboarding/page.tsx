'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  CookingFor,
  CookingSkill,
  DietType,
  SpiceLevel,
  TimePreference,
} from '@/types/index';
import Icon from '@/components/editorial/Icon';
import { Steam } from '@/components/editorial/DishArt';

interface Choice<T extends string> {
  value: T;
  emoji: string;
  label: string;
  hint: string;
}

const COOKING_FOR_OPTIONS: Choice<CookingFor>[] = [
  { value: 'alone', emoji: '👤', label: 'Sirf apne liye', hint: 'Single portions, kam leftovers' },
  { value: 'couple', emoji: '👫', label: 'Do log hain', hint: 'Balanced portions for two' },
  { value: 'family', emoji: '👨‍👩‍👧', label: 'Parivar ke liye', hint: 'Family-size quantity by default' },
  { value: 'pg', emoji: '🏠', label: 'PG / Hostel', hint: 'Simple recipes, limited setup' },
];

const DIET_OPTIONS: Choice<DietType>[] = [
  { value: 'veg', emoji: '🥬', label: 'Pure Veg', hint: 'Sirf vegetarian recipes' },
  { value: 'eggetarian', emoji: '🍳', label: 'Egg bhi chalta hai', hint: 'Veg ke saath egg recipes' },
  { value: 'non-veg', emoji: '🍗', label: 'Non-veg bhi', hint: 'Veg, egg aur non-veg sab' },
  { value: 'vegan', emoji: '🌱', label: 'Vegan', hint: 'Dairy aur animal products ke bina' },
  { value: 'jain', emoji: '🙏', label: 'Jain', hint: 'Jain-friendly recommendations' },
];

const REGION_OPTIONS: Choice<string>[] = [
  { value: 'Punjab-Haryana', emoji: '🌾', label: 'Punjab / Haryana', hint: 'Rich, homestyle north Indian' },
  { value: 'UP-Bihar', emoji: '🏛️', label: 'UP / Bihar', hint: 'Ghar ka familiar swad' },
  { value: 'Delhi-NCR', emoji: '🌆', label: 'Delhi / NCR', hint: 'Street food aur home classics' },
  { value: 'Rajasthan-MP', emoji: '🏔️', label: 'Rajasthan / MP', hint: 'Masaledar regional favourites' },
  { value: 'south-indian', emoji: '🥥', label: 'South Indian', hint: 'Dosa, rice, coconut flavours' },
  { value: 'bengali', emoji: '🐟', label: 'Bengali', hint: 'Mustard-led regional dishes' },
  { value: 'gujarati', emoji: '🥣', label: 'Gujarati', hint: 'Khatti-meethi comfort food' },
  { value: 'maharashtrian', emoji: '🌶️', label: 'Maharashtrian', hint: 'Bold masala and everyday meals' },
  { value: 'any', emoji: '🗺️', label: 'Sab chalega!', hint: 'Har region se explore karein' },
];

type SpiceChoice = 'mild' | 'medium' | 'hot' | 'very-hot';
const SPICE_OPTIONS: Choice<SpiceChoice>[] = [
  { value: 'mild', emoji: '🧊', label: 'Bilkul halka', hint: 'Soft flavours, minimum heat' },
  { value: 'medium', emoji: '🌶️', label: 'Thoda sa', hint: 'Everyday balanced masala' },
  { value: 'hot', emoji: '🔥', label: 'Achha teekha', hint: 'Noticeable heat and spice' },
  { value: 'very-hot', emoji: '💀', label: 'Jitna ho sake!', hint: 'Maximum teekha recommendations' },
];

const SKILL_OPTIONS: Choice<CookingSkill>[] = [
  { value: 'beginner', emoji: '🙂', label: 'Abhi seekh raha/rahi hoon', hint: 'Extra-clear steps and easy recipes' },
  { value: 'intermediate', emoji: '👨‍🍳', label: 'Theek-thaak aata hai', hint: 'Normal detail, more variety' },
  { value: 'expert', emoji: '🔥', label: 'Kaafi expert hoon', hint: 'Advanced techniques bhi chalegi' },
];

const TIME_OPTIONS: Choice<TimePreference>[] = [
  { value: '15min', emoji: '⚡', label: '15 minute mein', hint: 'Fastest practical recipes first' },
  { value: '30min', emoji: '⏰', label: '30 minute tak', hint: 'Quick but flexible meals' },
  { value: 'any', emoji: '🍲', label: 'Time ki dikkat nahi', hint: 'Slow cooking bhi explore karein' },
];

const KITCHEN_OPTIONS: Choice<string>[] = [
  { value: 'gas-stove', emoji: '🔥', label: 'Gas Stove', hint: 'Regular stovetop cooking' },
  { value: 'induction', emoji: '⚡', label: 'Induction', hint: 'Induction-friendly methods' },
  { value: 'microwave', emoji: '📡', label: 'Microwave', hint: 'Reheat and quick cooking' },
  { value: 'air-fryer', emoji: '💨', label: 'Air Fryer', hint: 'Crispy, lower-oil options' },
  { value: 'pressure-cooker', emoji: '🥘', label: 'Pressure Cooker', hint: 'Dal, chawal and one-pot meals' },
];

const ALL_KITCHEN = KITCHEN_OPTIONS.map((option) => option.value);
const TOTAL_STEPS = 7;
const STEP_LABELS = ['Portions', 'Diet', 'Region', 'Teekha', 'Skill', 'Time', 'Rasoi'];

interface ApiResult {
  ok?: boolean;
  degraded?: boolean;
  warnings?: string[];
  error?: string;
  requestId?: string;
}

interface ErrorState {
  message: string;
  requestId?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [cookingFor, setCookingFor] = useState<CookingFor | null>(null);
  const [diet, setDiet] = useState<DietType | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [spice, setSpice] = useState<SpiceChoice | null>(null);
  const [skill, setSkill] = useState<CookingSkill | null>(null);
  const [timePref, setTimePref] = useState<TimePreference | null>(null);
  const [kitchen, setKitchen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (step !== 0) return;
    const timer = window.setTimeout(() => setStep(1), 3200);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const progress = step === 0 ? 0 : Math.round((step / TOTAL_STEPS) * 100);

  const selectedSummary = useMemo(
    () => [
      choiceLabel(COOKING_FOR_OPTIONS, cookingFor),
      choiceLabel(DIET_OPTIONS, diet),
      choiceLabel(REGION_OPTIONS, region),
      choiceLabel(SPICE_OPTIONS, spice),
      choiceLabel(SKILL_OPTIONS, skill),
      choiceLabel(TIME_OPTIONS, timePref),
      kitchen.length > 0 ? `${kitchen.length} kitchen tools` : null,
    ],
    [cookingFor, diet, region, spice, skill, timePref, kitchen.length],
  );

  function toggleKitchen(value: string) {
    setKitchen((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function finish() {
    if (!cookingFor || !diet || !region || !spice || !skill || !timePref || kitchen.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const spiceToSave: SpiceLevel = spice === 'very-hot' ? 'hot' : spice;
      const response = await fetch('/api/users/onboarding', {
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

      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok || !result.ok) {
        setError({
          message: result.error ?? 'Preferences save nahi ho paayi. Dobara try karein.',
          requestId: result.requestId,
        });
        setLoading(false);
        return;
      }

      if (result.degraded) {
        console.warn('[onboarding] completed with optional preference warnings', {
          requestId: result.requestId,
          warnings: result.warnings,
        });
      }

      router.replace('/onboarding/done');
      router.refresh();
    } catch {
      setError({ message: 'Internet connection check karke dobara try karein.' });
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-[100dvh]"
      style={{
        background:
          'radial-gradient(circle at 8% 4%, rgba(232,100,12,.14), transparent 28rem), radial-gradient(circle at 96% 92%, rgba(45,106,79,.10), transparent 30rem), #f7f0e9',
      }}
    >
      <div className="mx-auto grid min-h-[100dvh] max-w-[1180px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <OnboardingSidebar
          step={step}
          progress={progress}
          selectedSummary={selectedSummary}
        />

        <section className="flex min-h-[100dvh] min-w-0 flex-col px-4 py-4 sm:px-8 sm:py-7 lg:px-10 lg:py-9">
          <MobileHeader step={step} progress={progress} />

          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center py-4 sm:py-8">
            {step === 0 ? (
              <WelcomeCard onStart={() => setStep(1)} />
            ) : (
              <QuestionCard
                step={step}
                progress={progress}
                error={error}
                onDismissError={() => setError(null)}
              >
                {step === 1 && (
                  <QuestionContent
                    eyebrow="Portion intelligence"
                    title="Aap kis ke liye pakate hain?"
                    subtitle="Arti ingredients ki quantity aur serving size isi choice se set karegi."
                    footer={
                      <ActionRow
                        onNext={() => setStep(2)}
                        nextDisabled={!cookingFor}
                        nextLabel="Diet choose karein"
                      />
                    }
                  >
                    <ChoiceGrid>
                      {COOKING_FOR_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={cookingFor === option.value}
                          onClick={() => setCookingFor(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 2 && (
                  <QuestionContent
                    eyebrow="Food preference"
                    title="Khaane mein kya chalega?"
                    subtitle="Recipe search, recommendations aur surprise suggestions sab isi filter ko follow karenge."
                    footer={
                      <ActionRow
                        onBack={() => setStep(1)}
                        onNext={() => setStep(3)}
                        nextDisabled={!diet}
                        nextLabel="Swad ka region"
                      />
                    }
                  >
                    <ChoiceGrid>
                      {DIET_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={diet === option.value}
                          onClick={() => setDiet(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 3 && (
                  <QuestionContent
                    eyebrow="Regional taste"
                    title="Kaunse ilaake ka swad pasand hai?"
                    subtitle="Yeh hard restriction nahi hai. Bas familiar regional dishes ko thodi priority milegi."
                    footer={
                      <ActionRow
                        onBack={() => setStep(2)}
                        onNext={() => setStep(4)}
                        nextDisabled={!region}
                        nextLabel="Teekha set karein"
                      />
                    }
                  >
                    <ChoiceGrid>
                      {REGION_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={region === option.value}
                          onClick={() => setRegion(option.value)}
                          compact
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 4 && (
                  <QuestionContent
                    eyebrow="Masala balance"
                    title="Teekha kitna pasand hai?"
                    subtitle="Arti mirch aur masale ka level aapke normal taste ke aas-paas rakhegi."
                    footer={
                      <ActionRow
                        onBack={() => setStep(3)}
                        onNext={() => setStep(5)}
                        nextDisabled={!spice}
                        nextLabel="Cooking level"
                      />
                    }
                  >
                    <ChoiceGrid>
                      {SPICE_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={spice === option.value}
                          onClick={() => setSpice(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 5 && (
                  <QuestionContent
                    eyebrow="Instruction depth"
                    title="Khaana banana kitna aata hai?"
                    subtitle="Beginners ko zyada guidance milegi; experienced cooks ko concise steps."
                    footer={
                      <ActionRow
                        onBack={() => setStep(4)}
                        onNext={() => setStep(6)}
                        nextDisabled={!skill}
                        nextLabel="Time preference"
                      />
                    }
                  >
                    <ChoiceGrid singleColumn>
                      {SKILL_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={skill === option.value}
                          onClick={() => setSkill(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 6 && (
                  <QuestionContent
                    eyebrow="Everyday pace"
                    title="Kitna time hota hai usually?"
                    subtitle="Busy days ke liye realistic recipes pehle dikhengi, impossible ‘5 minute’ promises nahi."
                    footer={
                      <ActionRow
                        onBack={() => setStep(5)}
                        onNext={() => setStep(7)}
                        nextDisabled={!timePref}
                        nextLabel="Rasoi setup"
                      />
                    }
                  >
                    <ChoiceGrid singleColumn>
                      {TIME_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={timePref === option.value}
                          onClick={() => setTimePref(option.value)}
                        />
                      ))}
                    </ChoiceGrid>
                  </QuestionContent>
                )}

                {step === 7 && (
                  <QuestionContent
                    eyebrow="Final step"
                    title="Rasoi mein kya kya available hai?"
                    subtitle="Jitne tools hain select karein. Arti unavailable equipment wali recipes ko avoid karegi."
                    helper={`${kitchen.length} selected`}
                    footer={
                      <ActionRow
                        onBack={() => setStep(6)}
                        onNext={() => void finish()}
                        nextDisabled={kitchen.length === 0 || loading}
                        nextLabel={loading ? 'Profile save ho rahi hai…' : 'Setup complete karein'}
                        loading={loading}
                        final
                      />
                    }
                  >
                    <ChoiceGrid>
                      {KITCHEN_OPTIONS.map((option) => (
                        <ChoiceCard
                          key={option.value}
                          option={option}
                          selected={kitchen.includes(option.value)}
                          onClick={() => toggleKitchen(option.value)}
                          multiple
                        />
                      ))}
                      <ChoiceCard
                        option={{
                          value: 'all',
                          emoji: '✅',
                          label: 'Sab kuch hai',
                          hint: 'Saare listed tools select karein',
                        }}
                        selected={kitchen.length === ALL_KITCHEN.length}
                        onClick={() =>
                          setKitchen(kitchen.length === ALL_KITCHEN.length ? [] : [...ALL_KITCHEN])
                        }
                        multiple
                      />
                    </ChoiceGrid>
                  </QuestionContent>
                )}
              </QuestionCard>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function OnboardingSidebar({
  step,
  progress,
  selectedSummary,
}: {
  step: number;
  progress: number;
  selectedSummary: Array<string | null>;
}) {
  return (
    <aside
      className="relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:p-8"
      style={{
        borderColor: 'rgba(132,80,44,.12)',
        background: 'linear-gradient(160deg, rgba(255,251,246,.96), rgba(250,230,211,.92))',
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(232,100,12,.18), transparent 67%)' }}
      />

      <div className="relative flex items-center gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: 'var(--hero)', boxShadow: '0 14px 32px rgba(191,78,6,.24)' }}
        >
          <span className="text-2xl" aria-hidden>🍲</span>
        </span>
        <div>
          <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Chef Arti</div>
          <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>Personal rasoi setup</p>
        </div>
      </div>

      <div className="relative mt-10">
        <p className="m-0 text-[12px] font-semibold uppercase tracking-[.14em]" style={{ color: 'var(--muted)' }}>
          Your progress
        </p>
        <div className="mt-3 flex items-end gap-2">
          <strong className="t-display text-[38px] leading-none" style={{ color: 'var(--text)' }}>{progress}%</strong>
          <span className="pb-1 text-xs" style={{ color: 'var(--muted)' }}>setup complete</span>
        </div>
      </div>

      <ol className="relative mt-8 space-y-1.5" aria-label="Onboarding progress">
        {STEP_LABELS.map((label, index) => {
          const itemStep = index + 1;
          const active = step === itemStep;
          const complete = step > itemStep;
          return (
            <li
              key={label}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 transition-colors"
              style={{ background: active ? 'rgba(232,100,12,.10)' : 'transparent' }}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
                style={{
                  color: active || complete ? '#fff' : 'var(--muted)',
                  background: complete ? 'var(--green)' : active ? 'var(--hero)' : 'rgba(128,98,68,.11)',
                }}
              >
                {complete ? <Icon name="check" size={13} color="#fff" sw={2.7} /> : itemStep}
              </span>
              <span className="text-[13px] font-medium" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="relative mt-auto rounded-2xl border bg-white/70 p-4" style={{ borderColor: 'var(--border)' }}>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--hero-dk)' }}>
          Aapki choices
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedSummary.filter(Boolean).length > 0 ? (
            selectedSummary.map((item, index) =>
              item ? (
                <span key={`${item}-${index}`} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--hero-lt)', color: 'var(--hero-dk)' }}>
                  {item}
                </span>
              ) : null,
            )
          ) : (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Choices yahan dikhengi</span>
          )}
        </div>
      </div>

      <p className="relative mt-4 text-[11px] leading-5" style={{ color: 'var(--muted)' }}>
        Aap baad mein Profile se har preference change kar sakte hain.
      </p>
    </aside>
  );
}

function MobileHeader({ step, progress }: { step: number; progress: number }) {
  return (
    <header className="flex items-center justify-between rounded-2xl border bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden" style={{ borderColor: 'rgba(132,80,44,.12)' }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: 'var(--hero-lt)' }}>🍲</span>
        <div>
          <div className="t-overline" style={{ color: 'var(--hero-dk)', fontSize: 9 }}>Chef Arti</div>
          <p className="m-0 text-xs font-semibold" style={{ color: 'var(--text)' }}>Rasoi setup</p>
        </div>
      </div>
      <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--hero-lt)', color: 'var(--hero-dk)' }}>
        {step === 0 ? 'Shuru karein' : `${step}/${TOTAL_STEPS} · ${progress}%`}
      </span>
    </header>
  );
}

function WelcomeCard({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="r-card relative overflow-hidden border bg-white px-6 py-10 text-center sm:px-12 sm:py-14"
      style={{ borderColor: 'rgba(232,100,12,.16)' }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-44"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(232,100,12,.18), transparent 68%)' }}
      />
      <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[30px] border bg-white" style={{ borderColor: 'var(--border)', boxShadow: '0 22px 54px rgba(111,54,18,.15)' }}>
        <Steam size={42} color="var(--terracotta)" />
        <span className="absolute bottom-3 text-3xl" aria-hidden>🍲</span>
      </div>
      <div className="relative mt-6 t-overline" style={{ color: 'var(--hero-dk)' }}>Namaste, welcome in</div>
      <h1 className="relative t-display mx-auto mt-2 max-w-[510px] text-[32px] leading-[1.12] sm:text-[42px]" style={{ color: 'var(--text)' }}>
        Chef Arti ko apni rasoi samjha dein
      </h1>
      <p className="relative mx-auto mt-4 max-w-[500px] text-[14px] leading-6 sm:text-[15px]" style={{ color: 'var(--muted)' }}>
        Saat focused choices. Uske baad quantities, difficulty, regional taste aur recipe suggestions aapke daily life ke hisaab se milengi.
      </p>

      <div className="relative mx-auto mt-7 grid max-w-[520px] gap-2.5 text-left sm:grid-cols-3">
        {[
          ['⚖️', 'Sahi quantity'],
          ['⏱️', 'Realistic time'],
          ['🍛', 'Aapka swad'],
        ].map(([emoji, label]) => (
          <div key={label} className="flex items-center gap-2 rounded-xl border bg-white/80 px-3 py-2.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <span>{emoji}</span>{label}
          </div>
        ))}
      </div>

      <button type="button" onClick={onStart} className="r-cta tap-spring relative mx-auto mt-8 max-w-[360px]">
        Apni rasoi setup karein <Icon name="chevR" size={19} color="#fff" />
      </button>
      <p className="relative mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>Lagbhag 60 seconds</p>
    </section>
  );
}

function QuestionCard({
  step,
  progress,
  error,
  onDismissError,
  children,
}: {
  step: number;
  progress: number;
  error: ErrorState | null;
  onDismissError: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="r-card overflow-hidden border bg-white/95"
      style={{ borderColor: 'rgba(132,80,44,.14)', boxShadow: '0 28px 80px rgba(73,36,14,.12)' }}
    >
      <div className="border-b px-5 py-4 sm:px-8" style={{ borderColor: 'var(--border)', background: 'rgba(255,248,240,.72)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[.13em]" style={{ color: 'var(--muted)' }}>Personal setup</span>
            <p className="m-0 mt-0.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>Step {step} of {TOTAL_STEPS}</p>
          </div>
          <strong className="text-sm" style={{ color: 'var(--hero-dk)' }}>{progress}%</strong>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(128,98,68,.12)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--hero), var(--terracotta))' }}
          />
        </div>
      </div>

      {error && (
        <div className="px-5 pt-5 sm:px-8" aria-live="assertive">
          <div className="flex items-start gap-3 rounded-2xl border px-4 py-3.5" style={{ borderColor: 'rgba(180,55,42,.25)', background: '#fff2ef', color: '#8f2e25' }}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: 'rgba(180,55,42,.11)' }}>!</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold leading-5">{error.message}</p>
              {error.requestId && (
                <p className="m-0 mt-1 break-all text-[10px] opacity-75">Reference: {error.requestId}</p>
              )}
            </div>
            <button type="button" onClick={onDismissError} className="min-h-8 min-w-8 rounded-full text-sm" aria-label="Error hatao">×</button>
          </div>
        </div>
      )}

      {children}
    </section>
  );
}

function QuestionContent({
  eyebrow,
  title,
  subtitle,
  helper,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  helper?: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in-up">
      <div className="px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>{eyebrow}</div>
            <h1 className="t-display mt-2 text-[27px] leading-[1.16] sm:text-[34px]" style={{ color: 'var(--text)' }}>{title}</h1>
            <p className="mt-3 max-w-[590px] text-[13.5px] leading-6 sm:text-[14px]" style={{ color: 'var(--muted)' }}>{subtitle}</p>
          </div>
          {helper && (
            <span className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'var(--green-lt)', color: 'var(--green)' }}>
              {helper}
            </span>
          )}
        </div>

        <div className="mt-6">{children}</div>
      </div>

      <div className="border-t px-4 py-4 sm:px-8 sm:py-5" style={{ borderColor: 'var(--border)', background: 'rgba(255,248,240,.58)' }}>
        {footer}
      </div>
    </div>
  );
}

function ChoiceGrid({ children, singleColumn = false }: { children: ReactNode; singleColumn?: boolean }) {
  return (
    <div className={`grid gap-3 ${singleColumn ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {children}
    </div>
  );
}

function ChoiceCard<T extends string>({
  option,
  selected,
  onClick,
  multiple = false,
  compact = false,
}: {
  option: Choice<T>;
  selected: boolean;
  onClick: () => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className="tap-spring group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border-2 text-left transition-all"
      style={{
        minHeight: compact ? 78 : 86,
        padding: compact ? '13px 14px' : '15px 16px',
        borderColor: selected ? 'var(--hero)' : 'var(--border)',
        background: selected ? 'linear-gradient(135deg, var(--hero-lt), #fff8f2)' : '#fff',
        boxShadow: selected ? '0 12px 28px rgba(191,78,6,.13)' : '0 4px 14px rgba(82,44,20,.035)',
      }}
    >
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[24px] transition-transform group-hover:scale-105"
        style={{ background: selected ? 'rgba(232,100,12,.13)' : 'rgba(128,98,68,.07)' }}
        aria-hidden
      >
        {option.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-5" style={{ color: 'var(--text)' }}>{option.label}</span>
        <span className="mt-1 block text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{option.hint}</span>
      </span>
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all"
        style={{
          borderColor: selected ? 'var(--hero)' : 'var(--border)',
          background: selected ? 'var(--hero)' : '#fff',
        }}
      >
        {selected && <Icon name="check" size={13} color="#fff" sw={2.7} />}
      </span>
    </button>
  );
}

function ActionRow({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  loading = false,
  final = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
  loading?: boolean;
  final?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="tap-spring flex min-h-13 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold disabled:opacity-40 sm:min-w-[132px]"
          style={{ borderColor: 'var(--border)', background: '#fff', color: 'var(--hero-dk)' }}
        >
          <Icon name="back" size={17} color="var(--hero-dk)" /> Wapas
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="r-cta tap-spring flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ minHeight: 54 }}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
        )}
        {nextLabel}
        {!loading && <Icon name={final ? 'sparkle' : 'chevR'} size={18} color="#fff" />}
      </button>
    </div>
  );
}

function choiceLabel<T extends string>(options: Choice<T>[], value: T | null): string | null {
  return value ? options.find((option) => option.value === value)?.label ?? null : null;
}
