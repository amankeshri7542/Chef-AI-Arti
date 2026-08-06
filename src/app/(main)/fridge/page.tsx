'use client';

import { useCallback, useRef, useState } from 'react';
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

const FLOW_META: Record<PageState, { step: number; label: string }> = {
  capture: { step: 1, label: 'Photo' },
  review: { step: 2, label: 'Ingredients' },
  results: { step: 3, label: 'Recipes' },
};

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid image data'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function FlowProgress({ state }: { state: PageState }) {
  const meta = FLOW_META[state];
  return (
    <div className="flow-progress" aria-label={`Step ${meta.step} of 3: ${meta.label}`}>
      <span className="flow-progress__label">{meta.step}/3 · {meta.label}</span>
      <span className="flow-progress__track" aria-hidden>
        <span className="flow-progress__bar" style={{ width: `${(meta.step / 3) * 100}%` }} />
      </span>
    </div>
  );
}

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
    if (generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const response = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: chips.map((chip) => chip.name),
          query: chips.map((chip) => chip.name).join(', '),
        }),
      });

      if (response.status === 429) {
        setGenError('Aaj ki recipe generation limit ho gayi. Kal phir try karein.');
        return;
      }
      if (!response.ok) {
        setGenError('Recipe abhi nahi ban saki. Dobara try karein.');
        return;
      }

      const data: { pendingId?: string } = await response.json();
      if (data.pendingId) {
        router.push('/recipe/pending/' + data.pendingId);
        return;
      }
      setGenError('Recipe abhi nahi ban saki. Dobara try karein.');
    } catch {
      setGenError('Internet connection check karke dobara try karein.');
    } finally {
      setGenerating(false);
    }
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);

    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 800,
        maxSizeMB: 1.5,
        useWebWorker: true,
      });
      const imageBase64 = await fileToBase64(compressed);

      const validateResponse = await fetch('/api/fridge/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      if (validateResponse.status === 429) {
        const data = await validateResponse.json();
        setError(data.error ?? 'Aaj ke scans khatam ho gaye.');
        setRemaining(0);
        return;
      }
      if (!validateResponse.ok) {
        const data = await validateResponse.json().catch(() => null);
        setError(data?.error ?? 'Photo clear nahi lagi. Fridge ko saamne se dobara photo lein.');
        return;
      }

      const scanResponse = await fetch('/api/fridge/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      if (scanResponse.status === 429) {
        const data = await scanResponse.json();
        setError(data.error ?? 'Aaj ke scans khatam ho gaye.');
        setRemaining(0);
        return;
      }
      if (!scanResponse.ok) {
        setError('Scan complete nahi hua. Photo clear karke dobara try karein.');
        return;
      }

      const data: { chips: IngredientChip[]; remaining: number } = await scanResponse.json();
      setChips(data.chips);
      setRemaining(data.remaining);
      setState('review');
    } catch {
      setError('Photo process nahi ho saki. Internet aur photo format check karke dobara try karein.');
    } finally {
      setLoading(false);
    }
  }, []);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = '';
  }

  async function handleConfirm() {
    if (chips.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const query = buildHinglishQuery(chips.map((chip) => chip.name));
      const response = await fetch('/api/recipes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        setError('Recipes abhi load nahi hui. Dobara try karein.');
        return;
      }

      const data: { recipes: Recipe[]; isEmptyStateFallback?: boolean } = await response.json();
      if (!data.recipes || data.recipes.length === 0) {
        setTriggerCase2(true);
        setRecipes([]);
      } else {
        setRecipes(data.recipes);
        setIsEmptyStateFallback(data.isEmptyStateFallback ?? false);
        setTriggerCase2(false);
      }
      setState('results');
    } catch {
      setError('Internet connection check karke dobara try karein.');
    } finally {
      setLoading(false);
    }
  }

  function resetToCapture() {
    setState('capture');
    setChips([]);
    setRecipes([]);
    setError(null);
    setGenError(null);
    setTriggerCase2(false);
    setIsEmptyStateFallback(false);
  }

  const hiddenInputs = (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </>
  );

  const renderHeader = (title: string, subtitle: string, onBack?: () => void) => (
    <>
      <header className="screen-header sticky top-0 z-20 flex items-start gap-3" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <BackButton fallback="/home" onClick={onBack} className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
        <div className="screen-header__copy pt-0.5">
          <div className="t-overline mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--hero-dk)' }}>
            <Icon name="fridge" size={14} color="var(--hero-dk)" /> Smart kitchen
          </div>
          <h1 className="screen-title">{title}</h1>
          <p className="screen-subtitle">{subtitle}</p>
        </div>
      </header>
      <FlowProgress state={state} />
    </>
  );

  if (state === 'capture') {
    return (
      <div className="app-screen safe-bottom">
        {hiddenInputs}
        {renderHeader('Fridge Scan', remaining > 0 ? `${remaining} scan${remaining === 1 ? '' : 's'} aaj baaki` : 'Aaj ke scans complete ho gaye')}

        <div className="screen-content screen-content--tight fade-in">
          <section className="camera-stage">
            <div className="camera-stage__orb"><Icon name="camera" size={38} color="var(--hero)" sw={1.7} /></div>
            <div className="t-overline mt-5" style={{ color: 'var(--hero-dk)' }}>AI ingredient scan</div>
            <h2 className="t-display mt-2" style={{ fontSize: 25, color: 'var(--text)' }}>Fridge ka ek clear photo</h2>
            <p className="mx-auto mt-2 max-w-[310px] text-[14px] leading-6" style={{ color: 'var(--muted)' }}>
              Arti ingredients pehchan kar sirf wahi recipes dikhayegi jo realistically ban sakti hain.
            </p>
            <div className="camera-tips" aria-label="Photo tips">
              <span className="camera-tip">💡 Light achhi ho</span>
              <span className="camera-tip">📦 Items visible ho</span>
              <span className="camera-tip">📷 Camera seedha ho</span>
            </div>
          </section>

          <div className="my-7 flex flex-col items-center">
            <button type="button" aria-label="Camera se fridge ki photo lein" disabled={remaining <= 0 || loading} onClick={() => cameraInputRef.current?.click()} className="capture-button tap-spring">
              <Icon name="camera" size={36} color="#fff" sw={1.8} />
            </button>
            <span className="mt-3 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{loading ? 'Photo process ho rahi hai…' : 'Camera kholne ke liye tap karein'}</span>
          </div>

          <button type="button" disabled={remaining <= 0 || loading} onClick={() => galleryInputRef.current?.click()} className="r-cta ghost tap-spring disabled:opacity-40">
            <Icon name="gallery" size={19} color="var(--hero-dk)" /> Gallery se photo choose karein
          </button>

          <div aria-live="polite" aria-busy={loading}>
            {loading && <ArtiLoader className="mt-6" message="Photo samajh rahi hoon" />}
          </div>

          {error && !loading && (
            <div role="alert" className="status-banner status-banner--error mt-4">
              <span aria-hidden>!</span>
              <p className="m-0 text-[13px] leading-5">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === 'review') {
    return (
      <div className="app-screen safe-bottom">
        {renderHeader('Ingredients check karein', 'Galat item hataiye, chhoota hua item add kariye', () => setState('capture'))}

        <div className="screen-content screen-content--tight fade-in">
          <div className="status-banner status-banner--success mb-5">
            <Icon name="check" size={20} color="var(--green)" sw={2.4} />
            <p className="m-0 text-[13.5px] leading-5"><strong>{chips.length} ingredients</strong> pehchane gaye. Recipe search se pehle list confirm karein.</p>
          </div>

          <SectionHead over="Detected ingredients" title="Aapke fridge mein" style={{ marginBottom: 14 }} />
          <div className="surface-card p-4">
            <IngredientChips chips={chips} onChange={setChips} />
          </div>

          {error && (
            <div role="alert" className="status-banner status-banner--error mt-4">
              <span aria-hidden>!</span><p className="m-0 text-[13px]">{error}</p>
            </div>
          )}

          <button type="button" disabled={chips.length === 0 || loading} onClick={() => void handleConfirm()} className="r-cta tap-spring mt-5 disabled:opacity-40" style={{ background: 'var(--green)' }} aria-busy={loading}>
            <Icon name="sparkle" size={20} color="#fff" /> {loading ? 'Matching recipes…' : `${chips.length} ingredients se recipes dekhein`}
          </button>
          <button type="button" onClick={() => setState('capture')} className="mt-2 min-h-12 w-full text-center text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>Nayi photo lena hai</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen safe-bottom">
      {renderHeader('Aap kya bana sakte hain', 'Aapke confirmed ingredients ke basis par', () => setState('review'))}

      <div className="screen-content screen-content--tight">
        {triggerCase2 ? (
          <div className="r-card card-entry p-6 text-center">
            {generating ? (
              <ArtiLoader message="Arti custom recipe bana rahi hai" />
            ) : (
              <>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px]" style={{ background: 'var(--hero-lt)' }}><Icon name="pot" size={30} color="var(--hero-dk)" sw={1.6} /></span>
                <div className="t-overline mt-4" style={{ color: 'var(--hero-dk)' }}>No exact match</div>
                <h2 className="t-display mt-2" style={{ fontSize: 22, color: 'var(--text)' }}>In ingredients ke liye custom recipe?</h2>
                <p className="mt-2 text-[14px] leading-6" style={{ color: 'var(--muted)' }}>Arti trusted video sources se ek workable recipe bana sakti hai.</p>
                <button type="button" onClick={() => void handleGenerate()} className="r-cta tap-spring mt-5" aria-busy={generating}>
                  <Icon name="sparkle" size={20} color="#fff" /> Custom recipe banao
                </button>
                {genError && <p role="alert" className="mt-3 text-[13px]" style={{ color: '#8f2e25' }}>{genError}</p>}
              </>
            )}
          </div>
        ) : (
          <>
            {isEmptyStateFallback && <div className="status-banner status-banner--warning mb-4"><p className="m-0 text-[13px]">Exact combination nahi mila, isliye closest practical recipes dikh rahi hain.</p></div>}
            <SectionHead over="Ingredient match" title="Yeh options practical hain" style={{ marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {recipes.map((recipe, index) => <GridCard key={recipe.id} recipe={recipe} idx={index % 6} onOpen={(id) => router.push('/recipe/' + id)} />)}
            </div>
          </>
        )}

        <button type="button" onClick={resetToCapture} className="r-cta ghost tap-spring mt-5">
          <Icon name="camera" size={19} color="var(--hero-dk)" /> Naya fridge scan
        </button>
      </div>
    </div>
  );
}
