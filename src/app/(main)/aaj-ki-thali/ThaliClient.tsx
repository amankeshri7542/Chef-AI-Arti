'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe } from '@/types/index';
import BackButton from '@/components/BackButton/BackButton';
import ArtiLoader from '@/components/ArtiLoader/ArtiLoader';
import Icon from '@/components/editorial/Icon';
import DishImage from '@/components/editorial/DishArt';

interface ThaliData {
  nashta: Recipe | null;
  dopahar: Recipe | null;
  raat: Recipe | null;
}

const MEAL_SLOTS = [
  { key: 'nashta' as const, index: '01', label: 'Nashta', time: 'Subah · 8:30', helper: 'Din ki easy shuruaat' },
  { key: 'dopahar' as const, index: '02', label: 'Dopahar', time: 'Lunch · 1:00', helper: 'Balanced ghar ka khaana' },
  { key: 'raat' as const, index: '03', label: 'Raat', time: 'Dinner · 8:00', helper: 'Halka aur satisfying' },
];

function todayKey(userId: string): string {
  const date = new Date();
  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `aaj_ki_thali_${userId}_${value}`;
}

export default function ThaliClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [thali, setThali] = useState<ThaliData | null>(null);
  const [loading, setLoading] = useState(true);
  const [planned, setPlanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlanned(Boolean(localStorage.getItem(todayKey(userId))));
  }, [userId]);

  const fetchThali = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/thali/suggest');
      if (!response.ok) {
        setError('Aaj ka meal plan abhi load nahi hua. Dobara try karein.');
        return;
      }
      const data: ThaliData = await response.json();
      setThali(data);
    } catch {
      setError('Internet connection check karke dobara try karein.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThali();
  }, [fetchThali]);

  const mealIds = [thali?.nashta?.id, thali?.dopahar?.id, thali?.raat?.id].filter(Boolean);
  const hasMeals = mealIds.length > 0;

  function confirmThali() {
    if (!hasMeals) return;
    localStorage.setItem(todayKey(userId), JSON.stringify(mealIds));
    setPlanned(true);
  }

  function resetThali() {
    localStorage.removeItem(todayKey(userId));
    setPlanned(false);
  }

  return (
    <div className="app-screen safe-bottom">
      <header className="screen-header sticky top-0 z-20 flex items-start gap-3" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
        <div className="screen-header__copy pt-0.5">
          <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Daily meal planner</div>
          <h1 className="screen-title">Aaj ki Thali</h1>
          <p className="screen-subtitle">Teen meals, ek clear plan</p>
        </div>
      </header>

      <div className="screen-content screen-content--tight">
        <section className="home-hero r-card card-entry stg-1">
          <div className="t-overline" style={{ color: 'var(--hero-dk)', marginBottom: 8 }}>Aaj ka plan</div>
          <h2 className="t-display" style={{ margin: 0, fontSize: 25, color: 'var(--text)', maxWidth: 330 }}>Har meal ka decision ek baar mein</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            Arti aapki preference ke hisaab se nashta, lunch aur dinner choose karti hai. Kisi bhi dish par tap karke details dekhein.
          </p>
        </section>

        <div aria-live="polite" aria-busy={loading}>
          {loading && <ArtiLoader className="py-16" message="Aaj ke meals balance kar rahi hoon" />}
        </div>

        {!loading && error && (
          <div role="alert" className="status-banner status-banner--error mt-5">
            <span aria-hidden>!</span>
            <div className="flex-1">
              <p className="m-0 text-[13.5px] leading-5">{error}</p>
              <button type="button" onClick={() => void fetchThali()} className="mt-2 min-h-11 text-[13px] font-semibold underline" style={{ color: 'inherit' }}>Dobara try karein</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="animate-content-fade mt-5 flex flex-col gap-3.5">
            {MEAL_SLOTS.map((slot, index) => {
              const recipe = thali?.[slot.key] ?? null;
              return (
                <article key={slot.key} className={`meal-card r-card card-entry stg-${index + 1}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="meal-card__number">{slot.index}</span>
                      <div>
                        <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>{slot.label}</div>
                        <p className="m-0 text-[11.5px]" style={{ color: 'var(--muted)' }}>{slot.helper}</p>
                      </div>
                    </div>
                    <span className="r-pill" style={{ height: 30, padding: '0 10px', fontSize: 11.5 }}>
                      <Icon name="clock" size={12} color="var(--muted)" /> {slot.time}
                    </span>
                  </div>

                  {recipe ? (
                    <button type="button" onClick={() => router.push(`/recipe/${recipe.id}`)} className="tap-spring flex w-full items-center gap-3 text-left" aria-label={`${recipe.name_hinglish} recipe kholein`}>
                      <DishImage recipe={recipe} sizes="76px" style={{ width: 76, height: 76, borderRadius: 18, flexShrink: 0 }} />
                      <span className="min-w-0 flex-1">
                        <span className="t-display block" style={{ fontSize: 18, color: 'var(--text)', lineHeight: 1.25 }}>{recipe.name_hinglish}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: 'var(--muted)' }}>
                          <span>{recipe.cook_time_minutes + recipe.prep_time_minutes} min</span>
                          <span aria-hidden>·</span>
                          <span>{recipe.spice_level}</span>
                        </span>
                      </span>
                      <Icon name="chevR" size={19} color="var(--muted)" />
                    </button>
                  ) : (
                    <div className="rounded-[18px] border border-dashed p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--hero-lt)' }}>
                      <p className="t-caption m-0">Is meal ke liye match nahi mila.</p>
                      <button type="button" onClick={() => router.push('/search')} className="r-chip on tap-spring mt-3" style={{ minHeight: 44 }}>
                        <Icon name="search" size={15} color="#fff" /> Khud choose karein
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {planned ? (
              <div className="status-banner status-banner--success mt-1 flex-col items-center text-center">
                <span className="grid h-11 w-11 place-items-center rounded-[15px]" style={{ background: 'rgba(45,106,79,.12)' }}><Icon name="check" size={22} color="var(--green)" sw={2.4} /></span>
                <div>
                  <p className="m-0 text-[15px] font-bold">Aaj ki thali set hai</p>
                  <p className="mt-1 text-[13px] leading-5">Ab cooking ke waqt sirf recipe follow karni hai.</p>
                </div>
                <button type="button" onClick={resetThali} className="min-h-11 text-[13px] font-semibold underline" style={{ color: 'var(--green)' }}>Plan unlock karke badlein</button>
              </div>
            ) : (
              <button type="button" onClick={confirmThali} disabled={!hasMeals} className="r-cta tap-spring mt-1" style={{ background: 'var(--green)' }}>
                <Icon name="check" size={20} color="#fff" sw={2.4} /> Aaj ka plan confirm karein
              </button>
            )}

            <button type="button" onClick={() => void fetchThali()} disabled={loading} className="r-cta ghost tap-spring">
              <Icon name="refresh" size={19} color="var(--hero-dk)" /> Naya combination suggest karo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
