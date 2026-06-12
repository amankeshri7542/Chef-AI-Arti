'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton/BackButton';
import RecipeCardCompact from '@/components/RecipeCard/RecipeCardCompact';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';
import type { Recipe } from '@/types/index';
import type { GeneratedRecipe } from '@/lib/generate-recipe';

interface Props {
  isPaid: boolean;
}

interface ChipDef {
  emoji: string;
  label: string;
}

const CHIPS: ChipDef[] = [
  { emoji: '🍚', label: 'Thanda Chawal' },
  { emoji: '🫓', label: 'Bachi Roti' },
  { emoji: '🫘', label: 'Aadhi Dal' },
  { emoji: '🥔', label: 'Pakay Aloo' },
  { emoji: '🥬', label: 'Bachi Sabzi' },
  { emoji: '🍳', label: 'Bacha Anda' },
  { emoji: '🧅', label: 'Pyaz Tamatar' },
  { emoji: '🍞', label: 'Double Roti' },
  { emoji: '🥛', label: 'Dahi/Chhachh' },
  { emoji: '➕', label: 'Kuch aur...' },
];

const CUSTOM_LABEL = 'Kuch aur...';

interface GeneratedResult {
  pendingId: string;
  recipe: GeneratedRecipe;
}

type Stage = 'select' | 'loading' | 'results';

export default function BachaHuaClient({ isPaid }: Props) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // ─── Upgrade wall (free users) ────────────────────────────────────────────
  if (!isPaid) {
    return (
      <div style={{ background: '#FFFDF9', minHeight: '100vh' }}>
        <div className="flex items-center px-2 pt-2">
          <BackButton fallback="/home" />
          <h1 className="text-[16px] font-bold text-[#1A1A1A] ml-1">Bacha Hua</h1>
        </div>

        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: '#FFF0E6', fontSize: 40 }}
          >
            🍱
          </div>
          <h2 className="text-[16px] font-bold text-[#1A1A1A]">Bacha Hua Mode</h2>
          <p className="mt-2 text-[13px] text-[#806244]">
            Bachi roti, thanda chawal, aadhi dal — sab kuch naye dish mein badlo!
          </p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="tap-spring mt-6 flex items-center justify-center rounded-xl bg-[#E8640C] px-6 text-[15px] font-bold text-white"
            style={{ minHeight: 48 }}
          >
            Premium lo — ₹150/mahine →
          </button>
        </div>

        <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </div>
    );
  }

  return <BachaHuaPaid router={router} />;
}

// ─── Paid flow ──────────────────────────────────────────────────────────────

function BachaHuaPaid({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const [stage, setStage] = useState<Stage>('select');
  const [selected, setSelected] = useState<string[]>([]);
  const [customActive, setCustomActive] = useState(false);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generated, setGenerated] = useState<GeneratedResult | null>(null);

  function toggleChip(label: string) {
    if (label === CUSTOM_LABEL) {
      setCustomActive((v) => !v);
      return;
    }
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }

  function buildIngredients(): string[] {
    const custom = customActive
      ? customText
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
    return [...selected, ...custom].slice(0, 5);
  }

  const hasSelection =
    selected.length > 0 ||
    (customActive && customText.trim().length > 0);

  async function handleSuggest() {
    const ingredients = buildIngredients();
    if (ingredients.length === 0) return;

    setError(null);
    setStage('loading');

    try {
      const res = await fetch('/api/bacha-hua/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });

      const data = (await res.json()) as {
        recipes?: Recipe[];
        generated?: GeneratedResult;
        error?: string;
      };

      if (res.status === 403) {
        setError('Yeh feature premium mein hai 🌟');
        setUpgradeOpen(true);
        setStage('select');
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Kuch gadbad ho gayi. Dobara try karein.');
        setStage('select');
        return;
      }

      setRecipes(data.recipes ?? []);
      setGenerated(data.generated ?? null);
      setStage('results');
    } catch {
      setError('Network error. Dobara try karein.');
      setStage('select');
    }
  }

  function reset() {
    setSelected([]);
    setCustomActive(false);
    setCustomText('');
    setRecipes([]);
    setGenerated(null);
    setError(null);
    setStage('select');
  }

  return (
    <div style={{ background: '#FFFDF9', minHeight: '100vh' }}>
      <div className="flex items-center px-2 pt-2">
        <BackButton fallback="/home" />
        <h1 className="text-[16px] font-bold text-[#1A1A1A] ml-1">Bacha Hua</h1>
      </div>

      {/* SELECT */}
      {stage === 'select' && (
        <div className="px-4 pb-24 pt-2">
          <h2 className="text-[14px] font-bold text-[#1A1A1A]">Kya bacha hai? 🍱</h2>
          <p className="mt-0.5 text-[13px] text-[#806244]">Ek ya zyada select karo</p>

          {error && (
            <p className="mt-3 text-[13px] font-medium text-[#BF4E06]">{error}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {CHIPS.map((chip) => {
              const isActive =
                chip.label === CUSTOM_LABEL
                  ? customActive
                  : selected.includes(chip.label);
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => toggleChip(chip.label)}
                  className="tap-spring flex items-center rounded-full px-3 text-[13px] font-medium"
                  style={{
                    minHeight: 48,
                    background: isActive ? '#FFF0E6' : '#FFFFFF',
                    border: isActive ? '2px solid #E8640C' : '1px solid #E8DDD0',
                    color: isActive ? '#E8640C' : '#1A1A1A',
                  }}
                >
                  <span className="mr-1.5">{chip.emoji}</span>
                  {chip.label}
                </button>
              );
            })}
          </div>

          {customActive && (
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Aur kya hai? (comma se alag karo)"
              className="mt-4 w-full rounded-xl border border-[#E8DDD0] bg-white px-4 text-[14px] text-[#1A1A1A] outline-none focus:border-[#E8640C]"
              style={{ minHeight: 48 }}
            />
          )}

          <button
            type="button"
            onClick={handleSuggest}
            disabled={!hasSelection}
            className="tap-spring mt-6 flex w-full items-center justify-center rounded-xl text-[15px] font-bold text-white"
            style={{
              minHeight: 48,
              background: hasSelection ? '#E8640C' : '#E8DDD0',
              opacity: hasSelection ? 1 : 0.7,
            }}
          >
            Suggest karo! →
          </button>
        </div>
      )}

      {/* LOADING */}
      {stage === 'loading' && (
        <div className="flex flex-col items-center px-6 pt-24 text-center">
          <ArtiLoader message="Arti soch rahi hai" />
        </div>
      )}

      {/* RESULTS */}
      {stage === 'results' && (
        <div className="px-4 pb-24 pt-2">
          <h2 className="text-[14px] font-bold text-[#1A1A1A]">
            Yeh bana sakte ho! 🍳
          </h2>

          {recipes.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {recipes.map((r) => (
                <RecipeCardCompact
                  key={r.id}
                  recipe={r}
                  onClick={() => router.push('/recipe/' + r.id)}
                />
              ))}
            </div>
          )}

          {generated && (
            <button
              type="button"
              onClick={() =>
                router.push('/recipe/pending/' + generated.pendingId)
              }
              className="mt-4 w-full overflow-hidden rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
              style={{
                background: '#FFF0E6',
                border: '1px solid #E8DDD0',
              }}
            >
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ background: '#E8640C' }}
              >
                Naya recipe ✨
              </span>
              <p className="mt-2 text-[15px] font-bold text-[#1A1A1A]">
                {generated.recipe.name_hinglish}
              </p>
              <p className="mt-0.5 text-[13px] text-[#806244]">Arti ka naya idea</p>
            </button>
          )}

          {recipes.length === 0 && !generated && (
            <p className="mt-6 text-[13px] text-[#806244]">
              Kuch nahi mila. Dobara koshish karein.
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            className="tap-spring mt-6 flex w-full items-center justify-center rounded-xl border border-[#E8DDD0] bg-white text-[14px] font-medium text-[#1A1A1A]"
            style={{ minHeight: 48 }}
          >
            Aur kuch try karo
          </button>
        </div>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
