'use client';

// RecipeCards.tsx — editorial recipe cards (Session-39).
//  • <RecipeCardV>  170×210 vertical card for horizontal home rows.
//  • <GridCard>     2-col card with photo + overlaid title for search results.
// Photo-first via <DishImage>; falls back to a DishArt illustration. Cards are
// read-only re: saving (a filled heart marks an already-saved recipe — tapping
// the card opens the detail page where save/rate live).

import type { Recipe } from '@/types/index';
import DishImage from './DishArt';
import Icon from './Icon';

const totalMin = (r: Recipe) => r.cook_time_minutes + r.prep_time_minutes;

function VratTag() {
  return (
    <span
      style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--green)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99 }}
    >
      <Icon name="om" size={11} sw={2} /> vrat
    </span>
  );
}

function SavedTag() {
  return (
    <span
      aria-label="Saved"
      style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <Icon name="heart" size={14} color="#C0392B" />
    </span>
  );
}

function Rating({ r, light = false }: { r: Recipe; light?: boolean }) {
  if (!(r.rating_count >= 1 && r.avg_rating > 0)) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: light ? '#fff' : '#8A5A05' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 4Z" fill={light ? '#F2B33D' : '#D99A06'} />
      </svg>
      {r.avg_rating.toFixed(1)}
    </span>
  );
}

export function RecipeCardV({ recipe, onOpen, saved, idx = 0 }: { recipe: Recipe; onOpen: (id: string) => void; saved?: boolean; idx?: number }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(recipe.id)}
      className={`tap-spring card-entry stg-${Math.min(idx + 1, 6)}`}
      style={{ width: 170, flexShrink: 0, display: 'block', textAlign: 'left' }}
    >
      <div className="r-card" style={{ overflow: 'hidden', borderRadius: 18, height: 210, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <DishImage recipe={recipe} sizes="170px" style={{ height: 124, width: '100%' }} />
        {recipe.is_vrat_friendly && <VratTag />}
        {saved && <SavedTag />}
        <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="t-display" style={{ fontSize: 16.5, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text)' }}>
            {recipe.name_hinglish}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} /> {totalMin(recipe)} min</span>
            <Rating r={recipe} />
          </div>
        </div>
      </div>
    </button>
  );
}

export function GridCard({ recipe, onOpen, saved, idx = 0 }: { recipe: Recipe; onOpen: (id: string) => void; saved?: boolean; idx?: number }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(recipe.id)}
      className={`tap-spring card-entry stg-${Math.min(idx + 1, 6)}`}
      style={{ display: 'block', width: '100%', textAlign: 'left' }}
    >
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px var(--shadow)' }}>
        <DishImage recipe={recipe} sizes="(max-width: 480px) 50vw, 220px" style={{ height: 150, width: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(44,24,16,0.72) 100%)' }} />
        {recipe.is_vrat_friendly && <VratTag />}
        {saved && <SavedTag />}
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
          <div className="t-display" style={{ color: '#fff', fontSize: 17, lineHeight: 1.15, marginBottom: 3 }}>{recipe.name_hinglish}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.92)', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={12} /> {totalMin(recipe)} min</span>
            <Rating r={recipe} light />
          </div>
        </div>
      </div>
    </button>
  );
}
