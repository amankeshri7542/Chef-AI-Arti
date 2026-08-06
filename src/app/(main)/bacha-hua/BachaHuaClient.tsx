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
    <header className="screen-header sticky top-0 z-20 flex items-start gap-3" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
      <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
      <div className="screen-header__copy pt-0.5">
        <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Zero-waste cooking</div>
        <h1 className="screen-title">Bacha Hua</h1>
        <p className="screen-subtitle">Leftovers ko practical nayi dish mein badlein</p>
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

  if (!isPaid) {
    return (
      <div className="app-screen safe-bottom">
        <BachaHeader />

        <div className="screen-content">
          <section className="home-hero r-card card-entry text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-[26px]" style={{ background: 'var(--hero-lt)', boxShadow: 'inset 0 1px 0 white' }}>
              <Icon name="pot" size={40} color="var(--hero-dk)" sw={1.5} />
            </span>
            <div className="t-overline mt-5" style={{ color: 'var(--hero-dk)' }}>Premium kitchen tool</div>
            <h2 className="t-display mt-2" style={{ fontSize: 26, color: 'var(--text)' }}>Bacha hua khaana waste nahi hoga</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-6" style={{ color: 'var(--muted)' }}>
              Roti, chawal, dal ya sabzi select kariye. Arti available leftovers se realistic dish suggest karegi.
            </p>
          </section>

          <div className="mt-5 grid gap-2.5">
            {[
              'Ek saath multiple leftovers combine karein',
              'Available ingredients ke hisaab se practical ideas',
              'Exact match na mile toh custom recipe generation',
            ].map((benefit) => (
              <div key={benefit} className="status-banner">
                <Icon name="check" size={18} color="var(--green)" sw={2.3} />
                <p className="m-0 text-[13.5px] leading-5">{benefit}</p>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setUpgradeOpen(true)} className="r-cta tap-spring mt-5">
            <Icon name="sparkle" size={20} color="#fff" /> Premium dekhein · ₹150/mahina
          </button>
          <p className="mt-3 text-center text-[11.5px] leading-5" style={{ color: 'var(--muted)' }}>Upgrade se pehle plan details clearly dikhengi.</p>
        </div>

        <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </div>
    );
  }

  return <BachaHuaPaid router={router} />;
}

function BachaHuaPaid({ router }: { router: ReturnType<typeof useRouter> }) {
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
      setCustomActive((current) => !current);
      return;
    }
    setSelected((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  }

  function buildIngredients(): string[] {
    const custom = customActive
      ? customText.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
    return [...selected, ...custom].slice(0, 5);
  }

  const hasSelection = selected.length > 0 || (customActive && customText.trim().length > 0);
  const selectedCount = buildIngredients().length;

  async function handleSuggest() {
    const ingredients = buildIngredients();
    if (ingredients.length === 0) return;

    setError(null);
    setStage('loading');

    try {
      const response = await fetch('/api/bacha-hua/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });

      const data = (await response.json()) as {
        recipes?: Recipe[];
        generated?: GeneratedResult;
        error?: string;
      };

      if (response.status === 403) {
        setError('Yeh feature premium access maang raha hai.');
        setUpgradeOpen(true);
        setStage('select');
        return;
      }
      if (!response.ok) {
        setError(data.error ?? 'Suggestions abhi load nahi hui. Dobara try karein.');
        setStage('select');
        return;
      }

      setRecipes(data.recipes ?? []);
      setGenerated(data.generated ?? null);
      setStage('results');
    } catch {
      setError('Internet connection check karke dobara try karein.');
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
    <div className="app-screen safe-bottom">
      <BachaHeader />

      {stage === 'select' && (
        <div className="screen-content screen-content--tight">
          <section className="home-hero r-card card-entry">
            <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Step 1 · Select leftovers</div>
            <h2 className="t-display mt-2" style={{ fontSize: 24, color: 'var(--text)' }}>Aaj kya bacha hai?</h2>
            <p className="mt-2 text-[14px] leading-6" style={{ color: 'var(--muted)' }}>Maximum 5 items choose karein. Arti combinations ko practical cooking time ke saath match karegi.</p>
          </section>

          {error && (
            <div role="alert" className="status-banner status-banner--error mt-4">
              <span aria-hidden>!</span><p className="m-0 text-[13px] leading-5">{error}</p>
            </div>
          )}

          <section className="mt-6">
            <SectionHead over="Quick selection" title="Jo available hai chunein" />
            <div className="surface-card mt-4 p-4">
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((chip) => {
                  const active = chip.label === CUSTOM_LABEL ? customActive : selected.includes(chip.label);
                  return (
                    <button key={chip.label} type="button" onClick={() => toggleChip(chip.label)} className={`r-chip tap-spring ${active ? 'on' : ''}`} aria-pressed={active}>
                      <span aria-hidden>{chip.emoji}</span> {chip.label}
                    </button>
                  );
                })}
              </div>

              {customActive && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-[12px] font-semibold" style={{ color: 'var(--text)' }}>Baaki ingredients</span>
                  <input type="text" value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="Jaise: paneer, hari chutney" className="input-surface w-full px-4 outline-none" />
                  <span className="mt-1.5 block text-[11px]" style={{ color: 'var(--muted)' }}>Multiple items ko comma se alag karein.</span>
                </label>
              )}
            </div>
          </section>

          <button type="button" onClick={() => void handleSuggest()} disabled={!hasSelection} className="r-cta tap-spring mt-5 disabled:opacity-50">
            <Icon name="sparkle" size={20} color="#fff" /> {selectedCount > 0 ? `${selectedCount} items se ideas dekhein` : 'Leftovers select karein'}
          </button>
        </div>
      )}

      {stage === 'loading' && (
        <div className="screen-content flex min-h-[58vh] flex-col items-center justify-center text-center" aria-live="polite" aria-busy="true">
          <ArtiLoader message="Leftovers ka best combination soch rahi hoon" />
          <p className="mt-4 max-w-[280px] text-[12.5px] leading-5" style={{ color: 'var(--muted)' }}>Exact match aur practical custom option dono check ho rahe hain.</p>
        </div>
      )}

      {stage === 'results' && (
        <div className="screen-content screen-content--tight">
          <section className="mb-5">
            <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Step 2 · Choose a dish</div>
            <h2 className="t-display mt-2" style={{ fontSize: 25, color: 'var(--text)' }}>Waste se next meal</h2>
            <p className="mt-2 text-[13.5px] leading-5" style={{ color: 'var(--muted)' }}>Recipe khol kar ingredients aur cooking steps confirm karein.</p>
          </section>

          {recipes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {recipes.map((recipe, index) => <GridCard key={recipe.id} recipe={recipe} idx={index % 6} onOpen={(id) => router.push('/recipe/' + id)} />)}
            </div>
          )}

          {generated && (
            <button type="button" onClick={() => router.push('/recipe/pending/' + generated.pendingId)} className="r-card tap-spring mt-4 block w-full p-4 text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: 'var(--hero)' }}>
                <Icon name="sparkle" size={11} color="#fff" /> Custom match
              </span>
              <p className="t-display mt-2" style={{ fontSize: 18, color: 'var(--text)' }}>{generated.recipe.name_hinglish}</p>
              <p className="t-caption mt-1">Arti ne aapke selected leftovers ke liye banaya hai.</p>
            </button>
          )}

          {recipes.length === 0 && !generated && (
            <div className="status-banner status-banner--warning">
              <p className="m-0 text-[13.5px] leading-5">Is combination ke liye abhi workable recipe nahi mili. Ingredients badal kar dobara try karein.</p>
            </div>
          )}

          <button type="button" onClick={reset} className="r-cta ghost tap-spring mt-5">
            <Icon name="refresh" size={19} color="var(--hero-dk)" /> Doosra combination try karein
          </button>
        </div>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
