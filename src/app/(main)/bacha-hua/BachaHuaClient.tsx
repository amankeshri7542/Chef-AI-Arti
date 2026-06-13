'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton/BackButton';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';
import type { Recipe } from '@/types/index';
import type { GeneratedRecipe } from '@/lib/generate-recipe';
import Icon from '@/components/editorial/Icon';
import { SectionHead } from '@/components/editorial/SectionHead';
import { GridCard } from '@/components/editorial/RecipeCards';

function BachaHeader() {
  return (
    <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
      <div>
        <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Leftovers → naya dish</div>
        <h1 className="t-display" style={{ fontSize: 20, margin: 0, color: 'var(--text)' }}>Bacha Hua</h1>
      </div>
    </header>
  );
}

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
      <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
        <BachaHeader />

        <div className="flex flex-col items-center text-center" style={{ padding: '56px 24px' }}>
          <span style={{ width: 80, height: 80, borderRadius: 22, background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pot" size={40} color="var(--hero-dk)" sw={1.5} />
          </span>
          <div className="t-overline" style={{ color: 'var(--hero-dk)', marginTop: 16 }}>Premium feature</div>
          <h2 className="t-display" style={{ fontSize: 23, margin: '4px 0 6px', color: 'var(--text)' }}>Bacha Hua Mode</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.55 }}>
            Bachi roti, thanda chawal, aadhi dal — sab kuch naye dish mein badlo!
          </p>
          <button type="button" onClick={() => setUpgradeOpen(true)} className="r-cta tap-spring" style={{ marginTop: 22, maxWidth: 280 }}>
            <Icon name="sparkle" size={20} color="#fff" /> Premium lein — ₹150/mahina
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
    <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
      <BachaHeader />

      {/* SELECT */}
      {stage === 'select' && (
        <div style={{ padding: '18px 18px 96px' }}>
          <SectionHead over="Kya bacha hai?" title="Chunein jo bacha hai" />
          <p className="t-caption" style={{ margin: '4px 0 0' }}>Ek ya zyada select karo</p>

          {error && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 500, color: 'var(--hero-dk)' }}>{error}</p>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {CHIPS.map((chip) => {
              const isActive = chip.label === CUSTOM_LABEL ? customActive : selected.includes(chip.label);
              return (
                <button key={chip.label} type="button" onClick={() => toggleChip(chip.label)} className={`r-chip tap-spring ${isActive ? 'on' : ''}`}>
                  <span>{chip.emoji}</span> {chip.label}
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
              className="outline-none"
              style={{ marginTop: 16, width: '100%', minHeight: 50, padding: '0 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, color: 'var(--text)' }}
            />
          )}

          <button type="button" onClick={handleSuggest} disabled={!hasSelection} className="r-cta tap-spring disabled:opacity-50" style={{ marginTop: 24 }}>
            <Icon name="sparkle" size={20} color="#fff" /> Suggest karo!
          </button>
        </div>
      )}

      {/* LOADING */}
      {stage === 'loading' && (
        <div className="flex flex-col items-center text-center" style={{ padding: '80px 24px' }}>
          <ArtiLoader message="Arti soch rahi hai" />
        </div>
      )}

      {/* RESULTS */}
      {stage === 'results' && (
        <div style={{ padding: '18px 18px 96px' }}>
          <SectionHead over="In cheezon se" title="Yeh banayein" style={{ marginBottom: 14 }} />

          {recipes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {recipes.map((r, i) => (
                <GridCard key={r.id} recipe={r} idx={i % 6} onOpen={(id) => router.push('/recipe/' + id)} />
              ))}
            </div>
          )}

          {generated && (
            <button
              type="button"
              onClick={() => router.push('/recipe/pending/' + generated.pendingId)}
              className="r-card tap-spring"
              style={{ marginTop: 14, width: '100%', padding: 16, textAlign: 'left', display: 'block' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--hero)' }}>
                <Icon name="sparkle" size={11} color="#fff" /> Naya recipe
              </span>
              <p className="t-display" style={{ marginTop: 8, fontSize: 17, color: 'var(--text)' }}>{generated.recipe.name_hinglish}</p>
              <p className="t-caption" style={{ marginTop: 2 }}>Arti ka naya idea — kholne ke liye tap karein</p>
            </button>
          )}

          {recipes.length === 0 && !generated && (
            <p className="t-caption" style={{ marginTop: 24 }}>Kuch nahi mila. Dobara koshish karein.</p>
          )}

          <button type="button" onClick={reset} className="r-cta ghost tap-spring" style={{ marginTop: 18, minHeight: 52 }}>
            <Icon name="refresh" size={19} color="var(--hero-dk)" /> Aur kuch try karo
          </button>
        </div>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
