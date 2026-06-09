'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import type { IngredientChip, Recipe } from '@/types/index';
import IngredientChips from '@/components/IngredientChips/IngredientChips';
import RecipeCard from '@/components/RecipeCard/RecipeCard';
import { buildHinglishQuery } from '@/lib/ingredient-map';
import BackButton from '@/components/BackButton/BackButton';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';

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
        body: JSON.stringify({ ingredients: chips.map((c) => c.name) }),
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

  // ─── STATE 1: Capture ────────────────────────────────────────
  if (state === 'capture') {
    return (
      <div className="flex min-h-screen flex-col bg-[#FFFDF9] px-4 py-4">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        <div className="flex items-center gap-2 mb-3">
          <BackButton fallback="/home" className="bg-[#FFF0E6] text-[#5C3D1E]" />
          <div>
            <h1 className="text-[16px] font-bold text-[#1A1A1A]">📷 Fridge Scan</h1>
            <p className="text-[12px] text-[#8B7355]">
              Fridge ki photo lo, hum dhundh lenge kya banao!
            </p>
            {remaining > 0 ? (
              <p className="text-[10px] text-[#8B7355]">{remaining}/2 scans aaj baaki</p>
            ) : (
              <p className="text-[10px] font-medium text-[#E8640C]">
                Aaj ke scans ho gaye! Kal phir aana
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={remaining <= 0 || loading}
          onClick={() => galleryInputRef.current?.click()}
          className="mt-6 flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed disabled:opacity-40"
          style={{ borderColor: '#F5A55B', background: '#FFF0E6', minHeight: 120 }}
        >
          <span className="text-[28px]" style={{ color: '#E8640C' }}>📷</span>
          <span className="text-[11px] text-[#1A1A1A]">Fridge ki photo lo</span>
          <span className="text-[9px] text-[#8B7355]">ya gallery se upload karo</span>
        </button>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={remaining <= 0 || loading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E8DDD0] bg-white text-[13px] font-medium text-[#1A1A1A] disabled:opacity-40"
          >
            📷 Camera se lo
          </button>
          <button
            type="button"
            disabled={remaining <= 0 || loading}
            onClick={() => galleryInputRef.current?.click()}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E8DDD0] bg-white text-[13px] font-medium text-[#1A1A1A] disabled:opacity-40"
          >
            🖼️ Gallery se upload karo
          </button>
        </div>

        {loading && <ArtiLoader className="mt-6" message="Dekh rahi hoon 👀" />}

        {error && !loading && (
          <div className="mt-4 rounded-xl border border-[#FBC08A] bg-[#FFF0E6] px-4 py-3">
            <p className="text-[13px] text-[#BF4E06]">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── STATE 2: Review ─────────────────────────────────────────
  if (state === 'review') {
    return (
      <div className="flex min-h-screen flex-col bg-[#FFFDF9] px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <BackButton fallback="/home" onClick={() => setState('capture')} className="bg-[#FFF0E6] text-[#5C3D1E]" />
          <div>
            <h1 className="text-[16px] font-bold text-[#1A1A1A]">Kya kya mila? 🔍</h1>
            <p className="text-[12px] text-[#8B7355]">
              Galat ho toh hatao, jo chhoot gaya wo add karo
            </p>
          </div>
        </div>

        <div className="mt-5">
          <IngredientChips chips={chips} onChange={setChips} />
        </div>

        <div className="mt-6">
          <button
            type="button"
            disabled={chips.length === 0 || loading}
            onClick={handleConfirm}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white disabled:opacity-40"
            style={{ background: '#2D6A4F' }}
          >
            {loading ? 'Dhundh rahi hoon...' : 'Haan, yahi sahi hai ✓'}
          </button>
        </div>
      </div>
    );
  }

  // ─── STATE 3: Results ────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9] px-4 py-4 pb-32">
      <div className="flex items-center gap-2 mb-3">
        <BackButton fallback="/home" onClick={() => setState('review')} className="bg-[#FFF0E6] text-[#5C3D1E]" />
        <h1 className="text-[16px] font-bold text-[#1A1A1A]">Yeh bana sakte ho! 🍳</h1>
      </div>

      {triggerCase2 ? (
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          {generating ? (
            <ArtiLoader message="Arti recipe bana rahi hai" />
          ) : (
            <>
              <p className="text-[15px] font-bold text-[#1A1A1A]">
                Koi recipe nahi mili — Arti banayegi? ✨
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex h-14 w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white"
                style={{ background: '#E8640C' }}
              >
                Haan, Arti se banwao!
              </button>
              {genError && (
                <p className="text-[13px] text-[#BF4E06]">{genError}</p>
              )}
              <button
                type="button"
                onClick={resetToCapture}
                className="flex h-12 items-center gap-2 rounded-xl border border-[#E8DDD0] bg-white px-6 text-[13px] font-medium text-[#1A1A1A]"
              >
                Fir se try karo
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {isEmptyStateFallback && (
            <p className="mt-3 text-[12px] text-[#8B7355]">
              Yeh combo nahi mila — par yeh popular recipes try karo!
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => router.push('/recipe/' + recipe.id)}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={resetToCapture}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-[#E8DDD0] bg-white text-[13px] font-medium text-[#1A1A1A]"
      >
        📷 Fir se scan karo
      </button>
    </div>
  );
}
