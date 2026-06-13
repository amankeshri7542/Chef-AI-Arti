'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeneratedRecipe } from '@/lib/generate-recipe';
import { getIngredientEmoji } from '@/lib/emoji';
import Icon from '@/components/editorial/Icon';
import DishImage from '@/components/editorial/DishArt';
import { SectionHead, Divider } from '@/components/editorial/SectionHead';

interface CookResult {
  promoted?: boolean;
  recipeId?: string;
  cooksNeeded?: number;
  alreadyCooked?: boolean;
}

interface Props {
  pendingId: string;
  recipe: GeneratedRecipe;
  cookedCount: number;
  status: string;
  youtubeVideoId?: string | null;
}

export default function PendingRecipeClient({ pendingId, recipe, youtubeVideoId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCooked() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/pending/${pendingId}/cook`, {
        method: 'POST',
      });
      if (!res.ok && res.status !== 200) {
        setError('Kuch gadbad ho gayi, dobara try karein');
        setLoading(false);
        return;
      }
      const data: CookResult = await res.json();
      setResult(data);
    } catch {
      setError('Kuch gadbad ho gayi, dobara try karein');
    }
    setLoading(false);
  }

  const heroRecipe = {
    id: pendingId,
    name_hinglish: recipe.name_hinglish,
    thumbnail_url: youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : null,
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100%', paddingBottom: 40 }}>
      {/* Hero */}
      <div className="tadka-host" style={{ position: 'relative', height: 260 }}>
        <DishImage recipe={heroRecipe} big priority sizes="100vw" style={{ position: 'absolute', inset: 0 }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(44,24,16,0.25) 0%, transparent 35%, transparent 50%, rgba(44,24,16,0.7) 100%)' }} />
        <button type="button" onClick={() => router.back()} aria-label="Wapas jao" className="tap-spring absolute left-3 top-3 flex items-center justify-center rounded-full" style={{ background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(6px)', height: 48, width: 48, zIndex: 3 }}>
          <Icon name="back" size={20} color="#fff" />
        </button>
        {youtubeVideoId && <p className="pointer-events-none absolute right-2 top-4 text-white/80" style={{ fontSize: 10, zIndex: 3 }}>📺 YouTube</p>}
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, zIndex: 3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,248,240,0.92)', color: 'var(--hero-dk)', fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 99, marginBottom: 8 }}>
            <Icon name="sparkle" size={12} color="var(--hero-dk)" /> Naya Recipe
          </span>
          <h1 className="t-display" style={{ color: '#fff', fontSize: 28, margin: 0, lineHeight: 1.15, textShadow: '0 2px 12px rgba(44,24,16,0.4)' }}>{recipe.name_hinglish}</h1>
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 16, padding: '14px 18px 0' }}>
        {/* Arti banner */}
        <div className="r-card" style={{ padding: '12px 16px', background: 'var(--hero-lt)', borderColor: '#F5A55B', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="sparkle" size={18} color="var(--hero-dk)" />
          <span style={{ fontSize: 13.5, color: 'var(--text)' }}>Arti ne yeh aapke liye banaya — try karke batao!</span>
        </div>

        {/* meta */}
        {(recipe.cook_time_minutes > 0 || recipe.description) && (
          <div>
            {recipe.cook_time_minutes > 0 && (
              <span className="r-pill" style={{ flexShrink: 0 }}><Icon name="clock" size={15} color="var(--hero-dk)" /> {recipe.cook_time_minutes} min</span>
            )}
            {recipe.description && <p style={{ marginTop: 12, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>{recipe.description}</p>}
          </div>
        )}

        <Divider />

        {/* Ingredients */}
        <section>
          <SectionHead over="Samagri" title="Kya kya chahiye" style={{ marginBottom: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {recipe.ingredients.map((ing, i) => (
              <div key={`${ing.name}-${i}`} className="r-card flex flex-col items-center text-center" style={{ padding: 14 }}>
                <span style={{ fontSize: 26, lineHeight: 1, marginBottom: 6 }}>{getIngredientEmoji(ing.name)}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)' }}>{ing.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--hero-dk)', marginTop: 3 }}>{ing.qty_desi}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section>
          <SectionHead over="Vidhi" title="Kaise banayein" style={{ marginBottom: 14 }} />
          <div className="flex flex-col" style={{ gap: 10 }}>
            {[...recipe.steps].sort((a, b) => a.step - b.step).map((s) => (
              <div key={s.step} className="r-card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'var(--hero)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{s.step}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text)' }}>{s.instruction}</p>
                  {s.time_minutes > 0 && (
                    <span className="r-pill" style={{ height: 26, padding: '0 10px', fontSize: 12, marginTop: 7 }}><Icon name="clock" size={12} color="var(--hero-dk)" /> {s.time_minutes} min</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cook action / result */}
        <section style={{ marginTop: 8, marginBottom: 16 }}>
          {!result ? (
            <>
              <button type="button" disabled={loading} onClick={handleCooked} className="r-cta tap-spring disabled:opacity-50" style={{ background: 'var(--green)' }}>
                <Icon name="check" size={20} color="#fff" sw={2.4} /> {loading ? 'Ruko zara…' : 'Bana liya!'}
              </button>
              {error && <p className="text-center" style={{ marginTop: 12, fontSize: 13, color: 'var(--hero-dk)' }}>{error}</p>}
            </>
          ) : result.alreadyCooked ? (
            <div className="r-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text)' }}>Aap pehle hi bana chuke ho 😊</p>
            </div>
          ) : result.promoted ? (
            <div className="r-card tadka-host" style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--green-lt)', borderColor: 'var(--green)' }}>
              <p className="t-display" style={{ fontSize: 18, color: 'var(--green)' }}>Mubarak ho! 🎉</p>
              <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--green)' }}>Yeh recipe ab sabke liye library mein aa gayi</p>
              {result.recipeId && (
                <button type="button" onClick={() => router.push('/recipe/' + result.recipeId)} className="r-cta tap-spring" style={{ marginTop: 14 }}>
                  Library mein dekho <Icon name="chevR" size={18} color="#fff" />
                </button>
              )}
            </div>
          ) : (
            <div className="r-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text)' }}>
                {result.cooksNeeded && result.cooksNeeded > 0
                  ? `${result.cooksNeeded} aur log isko banayein toh yeh library mein aa jaayega! 🎉`
                  : 'Bas thoda aur — yeh library mein aane hi waali hai! 🎉'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
