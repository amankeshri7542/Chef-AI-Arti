'use client';

import { useState, useEffect } from 'react';
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
  { key: 'nashta' as const, label: 'Nashta', time: 'Subah · 8:30 baje' },
  { key: 'dopahar' as const, label: 'Dopahar', time: 'Lunch · 1:00 baje' },
  { key: 'raat' as const, label: 'Raat', time: 'Dinner · 8:00 baje' },
];

function todayKey(userId: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `aaj_ki_thali_${userId}_${date}`;
}

export default function ThaliClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [thali, setThali] = useState<ThaliData | null>(null);
  const [loading, setLoading] = useState(true);
  const [planned, setPlanned] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(todayKey(userId))) setPlanned(true);
  }, [userId]);

  function confirmThali() {
    const ids = [thali?.nashta?.id, thali?.dopahar?.id, thali?.raat?.id].filter(Boolean);
    localStorage.setItem(todayKey(userId), JSON.stringify(ids));
    setPlanned(true);
  }

  function resetThali() {
    localStorage.removeItem(todayKey(userId));
    setPlanned(false);
  }

  async function fetchThali() {
    setLoading(true);
    try {
      const res = await fetch('/api/thali/suggest');
      if (res.ok) {
        const data = await res.json();
        setThali(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchThali();
  }, []);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100%', paddingBottom: 96 }}>
      {/* Header */}
      <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
        <div>
          <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Teen waqt ka plan</div>
          <h1 className="t-display" style={{ fontSize: 20, margin: 0, color: 'var(--text)' }}>Aaj ki Thali</h1>
        </div>
      </header>

      <div style={{ padding: '14px 18px 0' }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Arti ne aaj ke teeno waqt ka khaana chuna hai. Jo pasand na aaye, phir se suggest karwa lein!</p>
      </div>

      <div style={{ padding: '16px 18px 0' }}>
        {loading ? (
          <ArtiLoader className="py-16" message="Aaj ki thali soch rahi hai" />
        ) : (
          <div className="animate-content-fade flex flex-col" style={{ gap: 14 }}>
            {MEAL_SLOTS.map((slot, i) => {
              const recipe = thali?.[slot.key] ?? null;
              return (
                <div key={slot.key} className={`r-card card-entry stg-${i + 1}`} style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span className="t-overline" style={{ color: 'var(--hero-dk)' }}>{slot.label}</span>
                    <span className="t-caption">{slot.time}</span>
                  </div>
                  {recipe ? (
                    <button type="button" onClick={() => router.push(`/recipe/${recipe.id}`)} className="tap-spring" style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'center', textAlign: 'left' }}>
                      <DishImage recipe={recipe} sizes="64px" style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="t-display" style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{recipe.name_hinglish}</span>
                        <span className="t-caption" style={{ display: 'block', marginTop: 2 }}>{recipe.cook_time_minutes + recipe.prep_time_minutes} min · {recipe.spice_level}</span>
                      </span>
                      <Icon name="chevR" size={18} color="var(--muted)" />
                    </button>
                  ) : (
                    <div style={{ borderRadius: 14, border: '1.5px dashed var(--border)', background: 'var(--hero-lt)', padding: '16px', textAlign: 'center' }}>
                      <p className="t-caption" style={{ margin: '0 0 8px' }}>Koi recipe nahi mili — khud choose karein</p>
                      <button type="button" onClick={() => router.push('/search')} className="r-chip on tap-spring" style={{ minHeight: 44 }}>
                        <Icon name="search" size={15} color="#fff" /> Browse karein
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Action buttons */}
            <div className="flex flex-col" style={{ gap: 12, marginTop: 4 }}>
              {planned ? (
                <div className="r-card" style={{ padding: '16px', textAlign: 'center', background: 'var(--green-lt)', borderColor: 'var(--green)' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Icon name="check" size={18} color="var(--green)" sw={2.4} /> Aaj ki thali set hai!
                  </p>
                  <p style={{ marginTop: 4, fontSize: 13, color: 'var(--green)' }}>Aaj ka khaana plan ho gaya. Mazze se banao 💛</p>
                  <button type="button" onClick={resetThali} className="tap-spring" style={{ marginTop: 10, minHeight: 44, fontSize: 13, fontWeight: 600, color: 'var(--green)', textDecoration: 'underline' }}>
                    Badalna hai? Reset karo
                  </button>
                </div>
              ) : (
                <button type="button" onClick={confirmThali} className="r-cta tap-spring" style={{ background: 'var(--green)' }}>
                  <Icon name="check" size={20} color="#fff" sw={2.4} /> Yeh theek hai
                </button>
              )}
              <button type="button" onClick={fetchThali} className="r-cta ghost tap-spring" style={{ minHeight: 52 }}>
                <Icon name="refresh" size={19} color="var(--hero-dk)" /> Phir se suggest karo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
