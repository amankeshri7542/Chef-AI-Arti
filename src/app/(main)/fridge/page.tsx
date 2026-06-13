'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import type { IngredientChip, Recipe } from '@/types/index';
import IngredientChips from '@/components/IngredientChips/IngredientChips';
import { buildHinglishQuery } from '@/lib/ingredient-map';
import BackButton from '@/components/BackButton/BackButton';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';
import Icon from '@/components/editorial/Icon';
import { SectionHead } from '@/components/editorial/SectionHead';
import { GridCard } from '@/components/editorial/RecipeCards';

type PageState = 'capture' | 'review' | 'results';

export default function FridgePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<PageState>('capture');
  const [chips, setChips] = useState<IngredientChip[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isEmptyStateFallback, setIsEmptyStateFallback] = useState(false);
  const [triggerCase2, setTriggerCase2] = useState(false);
  const [remaining, setRemaining] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: chips.map((c) => c.name),
          query: chips.map((c) => c.name).join(', '),
        }),
      });

      if (res.status === 429) {
        setGenError('Aaj ki recipe generation limit ho gayi');
        setGenerating(false);
        return;
      }

      if (!res.ok) {
        setGenError('Kuch gadbad ho gayi, dobara try karein');
        setGenerating(false);
        return;
      }

      const data: { pendingId?: string } = await res.json();
      if (data.pendingId) {
        router.push('/recipe/pending/' + data.pendingId);
        return;
      }
      setGenError('Kuch gadbad ho gayi, dobara try karein');
      setGenerating(false);
    } catch {
      setGenError('Kuch gadbad ho gayi, dobara try karein');
      setGenerating(false);
    }
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);

    let base64: string;
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
      const arrayBuffer = await compressed.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
    } catch {
      setError('Photo compress nahi ho saki. Dobara try karein.');
      setLoading(false);
      return;
    }

    // Validate first (does NOT consume a scan token)
    const validateRes = await fetch('/api/fridge/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    if (validateRes.status === 429) {
      const data = await validateRes.json();
      setError(data.error);
      setRemaining(0);
      setLoading(false);
      return;
    }

    if (!validateRes.ok) {
      const data = await validateRes.json();
      setError(data.error ?? 'Kuch gadbad ho gayi. Dobara try karein.');
      setLoading(false);
      return;
    }

    // Scan (consumes one token)
    const scanRes = await fetch('/api/fridge/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    if (scanRes.status === 429) {
      const data = await scanRes.json();
      setError(data.error);
      setRemaining(0);
      setLoading(false);
      return;
    }

    if (!scanRes.ok) {
      setError('Scan fail ho gaya. Dobara try karein.');
      setLoading(false);
      return;
    }

    const data: { chips: IngredientChip[]; remaining: number; total: number } =
      await scanRes.json();
    setChips(data.chips);
    setRemaining(data.remaining);
    setLoading(false);
    setState('review');
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  async function handleConfirm() {
    setLoading(true);
    const query = buildHinglishQuery(chips.map((c) => c.name));
    const res = await fetch('/api/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      setLoading(false);
      return;
    }

    const data: { recipes: Recipe[]; isEmptyStateFallback?: boolean } = await res.json();

    if (!data.recipes || data.recipes.length === 0) {
      setTriggerCase2(true);
      setLoading(false);
      setState('results');
      return;
    }

    setRecipes(data.recipes);
    setIsEmptyStateFallback(data.isEmptyStateFallback ?? false);
    setTriggerCase2(false);
    setLoading(false);
    setState('results');
  }

  function resetToCapture() {
    setState('capture');
    setChips([]);
    setRecipes([]);
    setError(null);
    setTriggerCase2(false);
    setIsEmptyStateFallback(false);
  }

  const hiddenInputs = (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </>
  );

  const renderHeader = (title: string, sub?: string, onBack?: () => void) => (
    <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <BackButton fallback="/home" onClick={onBack} className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
      <div style={{ paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="fridge" size={17} color="var(--hero-dk)" />
          <h1 className="t-display" style={{ fontSize: 20, margin: 0, color: 'var(--text)' }}>{title}</h1>
        </div>
        {sub && <p className="t-caption" style={{ margin: '2px 0 0' }}>{sub}</p>}
      </div>
    </header>
  );

  // ─── STATE 1: Capture ────────────────────────────────────────
  if (state === 'capture') {
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
        {hiddenInputs}
        {renderHeader('Fridge Scan', remaining > 0 ? `Fridge ki photo lo · ${remaining}/2 scans aaj baaki` : 'Aaj ke scans ho gaye! Kal phir aana')}

        <div className="fade-in" style={{ padding: '20px 18px 0' }}>
          <div style={{ borderRadius: 22, border: '2px dashed var(--hero)', background: 'var(--hero-lt)', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ width: 78, height: 78, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--shadow)' }}>
                <Icon name="camera" size={36} color="var(--hero)" sw={1.6} />
              </span>
            </div>
            <h2 className="t-display" style={{ fontSize: 22, margin: '0 0 4px', color: 'var(--text)' }}>Fridge ki photo lo</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Jo bhi rakha hai, Arti dekh ke recipe bata degi</p>
          </div>

          {/* big friendly shutter */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '28px 0 18px' }}>
            <button
              type="button"
              aria-label="Camera se photo lo"
              disabled={remaining <= 0 || loading}
              onClick={() => cameraInputRef.current?.click()}
              className="tap-spring disabled:opacity-40"
              style={{ width: 86, height: 86, borderRadius: '50%', background: 'var(--hero)', border: '5px solid var(--card)', boxShadow: '0 0 0 3px var(--hero), 0 12px 30px -8px rgba(180,80,20,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="camera" size={34} color="#fff" sw={1.8} />
            </button>
          </div>
          <button
            type="button"
            disabled={remaining <= 0 || loading}
            onClick={() => galleryInputRef.current?.click()}
            className="r-cta ghost tap-spring disabled:opacity-40"
            style={{ minHeight: 52 }}
          >
            <Icon name="gallery" size={19} color="var(--hero-dk)" /> Gallery se upload karo
          </button>

          {loading && <ArtiLoader className="mt-6" message="Dekh rahi hoon 👀" />}

          {error && !loading && (
            <div className="r-card" style={{ marginTop: 16, padding: '12px 16px', background: 'var(--hero-lt)', borderColor: '#F5A55B' }}>
              <p style={{ fontSize: 13, color: 'var(--hero-dk)', margin: 0 }}>⚠️ {error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── STATE 2: Review ─────────────────────────────────────────
  if (state === 'review') {
    return (
      <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
        {renderHeader('Yeh sab dikha', 'Galat ho toh hatao, jo chhoot gaya wo add karo', () => setState('capture'))}

        <div className="fade-in" style={{ padding: '18px 18px 0' }}>
          <div className="r-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: 'var(--green-lt)', borderColor: 'var(--green)' }}>
            <Icon name="check" size={20} color="var(--green)" sw={2.4} />
            <span style={{ fontSize: 14, color: 'var(--green)' }}><strong>{chips.length} cheezein</strong> mili! Galat ho toh hata dein ya nayi jodein.</span>
          </div>

          <SectionHead over="Aapke fridge mein" title="Kya kya mila" style={{ marginBottom: 14 }} />
          <IngredientChips chips={chips} onChange={setChips} />

          <button
            type="button"
            disabled={chips.length === 0 || loading}
            onClick={handleConfirm}
            className="r-cta tap-spring disabled:opacity-40"
            style={{ marginTop: 20, background: 'var(--green)' }}
          >
            <Icon name="sparkle" size={20} color="#fff" /> {loading ? 'Dhundh rahi hoon…' : `Recipe dhundho (${chips.length})`}
          </button>
        </div>
      </div>
    );
  }

  // ─── STATE 3: Results ────────────────────────────────────────
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100%', paddingBottom: 96 }}>
      {renderHeader('Yeh ban sakta hai', 'Aapke fridge ki cheezon se', () => setState('review'))}

      <div style={{ padding: '18px 18px 0' }}>
        {triggerCase2 ? (
          <div className="r-card card-entry" style={{ padding: '26px 22px', textAlign: 'center' }}>
            {generating ? (
              <ArtiLoader message="Arti recipe bana rahi hai" />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="pot" size={30} color="var(--hero-dk)" sw={1.6} />
                  </span>
                </div>
                <h3 className="t-display" style={{ fontSize: 20, margin: '0 0 6px', color: 'var(--text)' }}>Koi recipe nahi mili</h3>
                <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14 }}>Koi baat nahi — Arti in cheezon se YouTube se dhundh ke bana degi ✨</p>
                <button type="button" onClick={handleGenerate} className="r-cta tap-spring">
                  <Icon name="sparkle" size={20} color="#fff" /> YouTube Recipe Banao
                </button>
                {genError && <p style={{ fontSize: 13, color: 'var(--hero-dk)', marginTop: 10 }}>{genError}</p>}
              </>
            )}
          </div>
        ) : (
          <>
            {isEmptyStateFallback && (
              <p className="t-caption" style={{ marginBottom: 12 }}>Yeh combo nahi mila — par yeh popular recipes try karo!</p>
            )}
            <SectionHead over="In samagri se" title="Yeh banayein" style={{ marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {recipes.map((recipe, i) => (
                <GridCard key={recipe.id} recipe={recipe} idx={i % 6} onOpen={(id) => router.push('/recipe/' + id)} />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={resetToCapture}
          className="r-cta ghost tap-spring"
          style={{ margin: '18px 0', minHeight: 52 }}
        >
          <Icon name="camera" size={19} color="var(--hero-dk)" /> Fir se scan karo
        </button>
      </div>
    </div>
  );
}
