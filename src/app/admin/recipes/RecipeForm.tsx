'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['sabzi', 'dal', 'roti', 'chawal', 'nashta', 'meetha'];
const DIETS = ['veg', 'non-veg', 'eggetarian'];
const REGIONS = [
  'UP', 'Bihar', 'Jharkhand', 'Delhi-NCR', 'Punjab', 'Haryana',
  'Rajasthan', 'MP', 'Bengal', 'Uttarakhand', 'pan-north-indian',
];
const SPICE_LEVELS = ['mild', 'medium', 'hot'];
const HEAVINESS = ['halka', 'medium', 'bhaari'];
const COOKING_STYLES = [
  'sukha', 'tariwala', 'bhuna', 'dum', 'tadka-based',
  'steamed', 'fried', 'roasted', 'boiled',
];
const SCALE_TYPES = ['linear', 'salt', 'spice', 'oil', 'water', 'fixed'];
const VIBES = [
  'halki-dish', 'taakat-wali', 'jaldi-bane', 'bacchon-ki-fav', 'tyohar-special',
  'teekha-alert', 'vrat-wali', 'comfort-food', 'tiffin-ready', 'monsoon-special',
  'sardi-warmth', 'garmi-cool', 'protein-rich', 'one-pot', 'leftover-friendly',
  'guest-special', 'bujurg-friendly', 'low-oil', 'bina-pyaz-lehsun',
];

interface IngredientRow {
  name: string;
  qty_desi: string;
  qty_metric: string;
  scale_type: string;
}

interface StepRow {
  instruction: string;
  time_minutes: number;
}

export interface RecipeFormValues {
  name_hinglish: string;
  name_hindi: string;
  description: string;
  category: string;
  diet_type: string;
  region_origin: string;
  spice_level: string;
  heaviness: string;
  cooking_style: string;
  cook_time_minutes: number;
  prep_time_minutes: number;
  base_family_size: number;
  is_vrat_friendly: boolean;
  ingredients: IngredientRow[];
  steps: StepRow[];
  tags: string;
  vibes: string[];
}

const EMPTY: RecipeFormValues = {
  name_hinglish: '',
  name_hindi: '',
  description: '',
  category: 'sabzi',
  diet_type: 'veg',
  region_origin: 'pan-north-indian',
  spice_level: 'medium',
  heaviness: 'medium',
  cooking_style: 'tariwala',
  cook_time_minutes: 30,
  prep_time_minutes: 10,
  base_family_size: 4,
  is_vrat_friendly: false,
  ingredients: [{ name: '', qty_desi: '', qty_metric: '', scale_type: 'linear' }],
  steps: [{ instruction: '', time_minutes: 5 }],
  tags: '',
  vibes: [],
};

const field = 'w-full rounded-lg border px-3 py-2 text-sm outline-none';
const fieldStyle = { background: '#1A1A2E', borderColor: '#0F3460', color: '#fff' };
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide';
const labelStyle = { color: '#B8B8D0' };

export default function RecipeForm({
  recipeId,
  initial,
}: {
  recipeId?: string;
  initial?: Partial<RecipeFormValues>;
}) {
  const router = useRouter();
  const [v, setV] = useState<RecipeFormValues>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function setIngredient(i: number, key: keyof IngredientRow, value: string) {
    setV((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[i] = { ...ingredients[i], [key]: value };
      return { ...prev, ingredients };
    });
  }

  function setStep(i: number, key: keyof StepRow, value: string | number) {
    setV((prev) => {
      const steps = [...prev.steps];
      steps[i] = { ...steps[i], [key]: value };
      return { ...prev, steps };
    });
  }

  function toggleVibe(vibe: string) {
    setV((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(vibe)
        ? prev.vibes.filter((x) => x !== vibe)
        : [...prev.vibes, vibe],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const ingredients = v.ingredients.filter((i) => i.name.trim());
    const steps = v.steps.filter((s) => s.instruction.trim());
    if (!v.name_hinglish.trim() || ingredients.length === 0 || steps.length === 0) {
      setError('Name, at least one ingredient and one step are required.');
      return;
    }

    setSaving(true);
    const payload = {
      name_hinglish: v.name_hinglish.trim(),
      name_hindi: v.name_hindi.trim() || null,
      description: v.description.trim() || null,
      category: v.category,
      diet_type: v.diet_type,
      region_origin: v.region_origin,
      spice_level: v.spice_level,
      heaviness: v.heaviness,
      cooking_style: v.cooking_style,
      cook_time_minutes: Number(v.cook_time_minutes) || 0,
      prep_time_minutes: Number(v.prep_time_minutes) || 0,
      base_family_size: Number(v.base_family_size) || 4,
      is_vrat_friendly: v.is_vrat_friendly,
      ingredients,
      steps: steps.map((s, i) => ({
        step: i + 1,
        instruction: s.instruction.trim(),
        time_minutes: Number(s.time_minutes) || 0,
      })),
      tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
      vibes: v.vibes,
    };

    try {
      const res = await fetch(
        recipeId ? `/api/admin/recipes/${recipeId}` : '/api/admin/recipes',
        {
          method: recipeId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
      } else {
        router.push('/admin/recipes');
        router.refresh();
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">
        {recipeId ? '✏️ Edit Recipe' : '➕ New Recipe'}
      </h1>

      <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} style={labelStyle}>Name (Hinglish) *</label>
            <input className={field} style={fieldStyle} value={v.name_hinglish}
              onChange={(e) => set('name_hinglish', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Name (Hindi)</label>
            <input className={field} style={fieldStyle} value={v.name_hindi}
              onChange={(e) => set('name_hindi', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} style={labelStyle}>Description</label>
            <textarea className={field} style={fieldStyle} rows={2} value={v.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Category</label>
            <select className={field} style={fieldStyle} value={v.category}
              onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Diet</label>
            <select className={field} style={fieldStyle} value={v.diet_type}
              onChange={(e) => set('diet_type', e.target.value)}>
              {DIETS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Region</label>
            <select className={field} style={fieldStyle} value={v.region_origin}
              onChange={(e) => set('region_origin', e.target.value)}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Spice Level</label>
            <select className={field} style={fieldStyle} value={v.spice_level}
              onChange={(e) => set('spice_level', e.target.value)}>
              {SPICE_LEVELS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Heaviness</label>
            <select className={field} style={fieldStyle} value={v.heaviness}
              onChange={(e) => set('heaviness', e.target.value)}>
              {HEAVINESS.map((h) => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Cooking Style</label>
            <select className={field} style={fieldStyle} value={v.cooking_style}
              onChange={(e) => set('cooking_style', e.target.value)}>
              {COOKING_STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Cook Time (min)</label>
            <input type="number" min={0} className={field} style={fieldStyle}
              value={v.cook_time_minutes}
              onChange={(e) => set('cook_time_minutes', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Prep Time (min)</label>
            <input type="number" min={0} className={field} style={fieldStyle}
              value={v.prep_time_minutes}
              onChange={(e) => set('prep_time_minutes', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Base Family Size</label>
            <input type="number" min={1} max={15} className={field} style={fieldStyle}
              value={v.base_family_size}
              onChange={(e) => set('base_family_size', Number(e.target.value))} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={v.is_vrat_friendly}
                onChange={(e) => set('is_vrat_friendly', e.target.checked)} />
              Vrat-friendly 🙏
            </label>
          </div>
        </div>
      </div>

      {/* Ingredients editor */}
      <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
        <h2 className="mb-3 font-semibold">🥕 Ingredients</h2>
        <div className="space-y-2">
          {v.ingredients.map((ing, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className={`${field} flex-1`} style={fieldStyle} placeholder="Name (e.g. aloo)"
                value={ing.name} onChange={(e) => setIngredient(i, 'name', e.target.value)} />
              <input className={`${field} w-28 flex-none`} style={fieldStyle} placeholder="Qty desi"
                value={ing.qty_desi} onChange={(e) => setIngredient(i, 'qty_desi', e.target.value)} />
              <input className={`${field} w-28 flex-none`} style={fieldStyle} placeholder="Qty metric"
                value={ing.qty_metric} onChange={(e) => setIngredient(i, 'qty_metric', e.target.value)} />
              <select className={`${field} w-28 flex-none`} style={fieldStyle} value={ing.scale_type}
                onChange={(e) => setIngredient(i, 'scale_type', e.target.value)}>
                {SCALE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button type="button" className="px-2 text-red-400"
                onClick={() => set('ingredients', v.ingredients.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: '#0F3460' }}
          onClick={() => set('ingredients', [...v.ingredients, { name: '', qty_desi: '', qty_metric: '', scale_type: 'linear' }])}>
          + Add ingredient
        </button>
      </div>

      {/* Steps editor */}
      <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
        <h2 className="mb-3 font-semibold">📝 Steps</h2>
        <div className="space-y-2">
          {v.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-6 text-sm font-bold" style={{ color: '#E8640C' }}>
                {i + 1}.
              </span>
              <textarea className={`${field} flex-1`} style={fieldStyle} rows={2}
                placeholder="Step instruction" value={s.instruction}
                onChange={(e) => setStep(i, 'instruction', e.target.value)} />
              <input type="number" min={0} className={`${field} w-20 flex-none`} style={fieldStyle}
                title="Minutes" value={s.time_minutes}
                onChange={(e) => setStep(i, 'time_minutes', Number(e.target.value))} />
              <button type="button" className="mt-2 px-2 text-red-400"
                onClick={() => set('steps', v.steps.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: '#0F3460' }}
          onClick={() => set('steps', [...v.steps, { instruction: '', time_minutes: 5 }])}>
          + Add step
        </button>
      </div>

      {/* Tags + vibes */}
      <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
        <label className={labelCls} style={labelStyle}>Tags (comma-separated)</label>
        <input className={field} style={fieldStyle} placeholder="e.g. tiffin, soup, monsoon"
          value={v.tags} onChange={(e) => set('tags', e.target.value)} />
        <p className={`${labelCls} mt-4`} style={labelStyle}>Vibes</p>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => (
            <button key={vibe} type="button" onClick={() => toggleVibe(vibe)}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: v.vibes.includes(vibe) ? '#E8640C' : '#1A1A2E',
                color: v.vibes.includes(vibe) ? '#fff' : '#B8B8D0',
              }}>
              {vibe}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-50"
          style={{ background: '#E8640C' }}>
          {saving ? 'Saving… (embedding)' : recipeId ? 'Save Changes' : 'Create Recipe'}
        </button>
        <button type="button" onClick={() => router.push('/admin/recipes')}
          className="rounded-lg px-6 py-3 font-semibold"
          style={{ background: '#0F3460' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
