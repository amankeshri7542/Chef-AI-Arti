'use client';

import { Recipe } from '@/types/index';
import AnimatedNumber from '@/components/AnimatedNumber/AnimatedNumber';

interface Props {
  nutrition: Recipe['nutrition'];
  currentServings: number;
  baseServings: number;
}

const MACRO_COLORS = {
  protein: '#2D6A4F',
  carbs: '#E8640C',
  fat: '#F5A55B',
  fiber: '#9FE1CB',
};

export default function NutritionDisplay({ nutrition, currentServings, baseServings }: Props) {
  if (!nutrition) return null;

  // per_serving is already ONE person's macros — total for N people is × N.
  // (Old `currentServings / baseServings` divided by base a second time,
  // showing Chicken Biryani as 6.3g protein instead of 25g.)
  const ratio = currentServings;

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

  // Calculate percentages for donut
  const totalCalFromMacros =
    scaled.protein_g * 4 + scaled.carbs_g * 4 + scaled.fat_g * 9 + scaled.fiber_g * 2;
  
  const pcts = totalCalFromMacros > 0 ? {
    protein: (scaled.protein_g * 4 / totalCalFromMacros) * 100,
    carbs: (scaled.carbs_g * 4 / totalCalFromMacros) * 100,
    fat: (scaled.fat_g * 9 / totalCalFromMacros) * 100,
    fiber: (scaled.fiber_g * 2 / totalCalFromMacros) * 100,
  } : { protein: 25, carbs: 25, fat: 25, fiber: 25 };

  // SVG donut params
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 10;

  // Calculate offsets for each arc
  const arcs = [
    { key: 'protein', pct: pcts.protein, color: MACRO_COLORS.protein },
    { key: 'carbs', pct: pcts.carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', pct: pcts.fat, color: MACRO_COLORS.fat },
    { key: 'fiber', pct: pcts.fiber, color: MACRO_COLORS.fiber },
  ];

  let cumulativeOffset = 0;

  const macroRows = [
    { emoji: '💪', label: 'Protein', value: scaled.protein_g, unit: 'g', color: MACRO_COLORS.protein },
    { emoji: '🌾', label: 'Carbs', value: scaled.carbs_g, unit: 'g', color: MACRO_COLORS.carbs },
    { emoji: '💧', label: 'Fat', value: scaled.fat_g, unit: 'g', color: MACRO_COLORS.fat },
    { emoji: '🌿', label: 'Fiber', value: scaled.fiber_g, unit: 'g', color: MACRO_COLORS.fiber },
  ];

  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFF8F0)', border: '1px solid #E8DDD0' }}
    >
      <div className="flex items-center gap-4">
        {/* Left — SVG donut */}
        <div className="flex-shrink-0 relative" style={{ width: 100, height: 100 }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            {arcs.map((arc) => {
              const dashLen = (arc.pct / 100) * circumference;
              const dashGap = circumference - dashLen;
              const offset = -(cumulativeOffset / 100) * circumference;
              cumulativeOffset += arc.pct;

              return (
                <circle
                  key={arc.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLen} ${dashGap}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedNumber value={scaled.calories} className="text-[16px] font-bold text-[#1A1A1A]" />
            <span className="text-[9px] text-[#8B7355]">kcal</span>
          </div>
        </div>

        {/* Right — Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {macroRows.map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <span
                className="flex-shrink-0 rounded-full"
                style={{ width: 8, height: 8, background: m.color }}
              />
              <span className="text-[11px] text-[#5C3D1E]">
                {m.emoji} {m.label}:
              </span>
              <span className="text-[11px] font-semibold text-[#1A1A1A] ml-auto">
                <AnimatedNumber value={m.value} decimals={1} />{m.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid #E8DDD0' }}>
        <span className="text-[11px] font-semibold text-[#1A1A1A]">{heavinessLabel}</span>
        <span className="text-[10px] text-[#8B7355]">{currentServings} logon ke liye total</span>
      </div>

      {/* Low confidence disclaimer */}
      {nutrition.confidence === 'low' && (
        <p className="mt-1 text-[9px] text-[#8B7355] italic">
          ~Anumaan hai, exact nahi
        </p>
      )}
    </div>
  );
}
