'use client';

import { Recipe } from '@/types/index';

interface Props {
  nutrition: Recipe['nutrition'];
  currentServings: number;
  baseServings: number;
}

const MACRO_CONFIG = [
  { key: 'protein_g' as const, label: '💪 Protein', unit: 'g', max: 30, color: '#2D6A4F' },
  { key: 'carbs_g' as const,   label: '🌾 Carbs',   unit: 'g', max: 80, color: '#E8640C' },
  { key: 'fat_g' as const,     label: '💧 Fat',     unit: 'g', max: 25, color: '#F5A55B' },
  { key: 'fiber_g' as const,   label: '🌿 Fiber',   unit: 'g', max: 10, color: '#9FE1CB' },
];

export default function NutritionDisplay({ nutrition, currentServings, baseServings }: Props) {
  if (!nutrition) return null;

  const ratio = currentServings / baseServings;

  const scaled = {
    calories: Math.round(nutrition.per_serving.calories * ratio),
    protein_g: +(nutrition.per_serving.protein_g * ratio).toFixed(1),
    carbs_g: +(nutrition.per_serving.carbs_g * ratio).toFixed(1),
    fat_g: +(nutrition.per_serving.fat_g * ratio).toFixed(1),
    fiber_g: +(nutrition.per_serving.fiber_g * ratio).toFixed(1),
  };

  const calPerPerson = scaled.calories / currentServings;
  const heavinessLabel =
    calPerPerson < 150 ? 'Halki dish 🌿' :
    calPerPerson < 300 ? 'Medium dish 🍽️' :
                         'Bhaari dish 💪';

  return (
    <div
      className="rounded-xl px-4 py-3 my-2"
      style={{ background: '#F9F5F0', border: '1px solid #E8DDD0' }}
    >
      {/* Headline row */}
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[13px] font-semibold text-[#1A1A1A]">{heavinessLabel}</span>
        <span className="text-[13px] text-[#8B7355]">{scaled.calories} kcal</span>
      </div>
      <p className="text-[10px] text-[#8B7355] mb-3">
        {currentServings} logon ke liye total
      </p>

      {/* Macro bars */}
      <div className="flex flex-col gap-2">
        {MACRO_CONFIG.map(({ key, label, unit, max, color }) => {
          const value = scaled[key];
          const pct = Math.min((value / max) * 100, 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-[72px] flex-shrink-0 text-[10px] text-[#5C3D1E]">{label}</span>
              <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: '#E8DDD0' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="w-[38px] text-right text-[10px] font-semibold text-[#1A1A1A] flex-shrink-0">
                {value}{unit}
              </span>
            </div>
          );
        })}
      </div>

      {/* Low confidence disclaimer */}
      {nutrition.confidence === 'low' && (
        <p className="mt-2 text-[9px] text-[#8B7355] italic">
          ~Anumaan hai, exact nahi
        </p>
      )}
    </div>
  );
}
