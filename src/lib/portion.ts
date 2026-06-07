import type { Ingredient } from '@/types/index';

// ─────────────────────────────────────
// Parsing helpers
// ─────────────────────────────────────

function parseDesi(qty: string): { value: number; unit: string } {
  const normalized = qty
    .replace('½', '0.5')
    .replace('¼', '0.25')
    .replace('¾', '0.75')
    .replace('⅓', '0.3333')
    .replace('⅔', '0.6667')
    .replace('⅛', '0.125')
    .trim();

  const match = normalized.match(/^([\d.]+)\s*(.+)$/);
  if (!match) return { value: 1, unit: qty.trim() };
  return { value: parseFloat(match[1]), unit: match[2].trim() };
}

function formatDesi(value: number, unit: string): string {
  const rounded = Math.round(Math.max(value, 0.25) * 4) / 4;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 4) / 4;

  let fracStr = '';
  if (frac === 0.25) fracStr = '¼';
  else if (frac === 0.5) fracStr = '½';
  else if (frac === 0.75) fracStr = '¾';

  if (whole === 0) return `${fracStr} ${unit}`;
  if (frac === 0) return `${whole} ${unit}`;
  return `${whole}${fracStr} ${unit}`;
}

function parseMetric(qty: string): { value: number; unit: string } {
  const match = qty.trim().match(/^([\d.]+)\s*(.+)$/);
  if (!match) return { value: 1, unit: qty.trim() };
  return { value: parseFloat(match[1]), unit: match[2].trim() };
}

function roundToFive(n: number): number {
  return Math.round(n / 5) * 5;
}

// ─────────────────────────────────────
// Scale factor per ingredient type
// Cooking-tested values — do not change without re-testing
// ─────────────────────────────────────

function getScaleFactor(ratio: number, scaleType: Ingredient['scale_type']): number {
  switch (scaleType) {
    case 'linear': return ratio;
    case 'oil':    return ratio * 0.6;   // 60% — oil pools, doesn't scale linearly
    case 'salt':   return ratio * 0.7;   // 70% — salt perception is logarithmic
    case 'spice':  return ratio * 0.65;  // 65% — heat compounds, add incrementally
    case 'water':  return Math.min(ratio, 2); // cap at 2× — evaporation plateau
    case 'fixed':  return 1;             // whole spices — do not scale
  }
}

// ─────────────────────────────────────
// Public API
// ─────────────────────────────────────

/**
 * Scale ingredient quantities from one family size to another.
 * Pure math — zero API calls. Safe to call in client components.
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  fromSize: number,
  toSize: number,
): Ingredient[] {
  if (fromSize === toSize) return ingredients;
  const ratio = toSize / fromSize;

  return ingredients.map((ing) => {
    if (ing.scale_type === 'fixed') return { ...ing };

    const factor = getScaleFactor(ratio, ing.scale_type);
    const desi = parseDesi(ing.qty_desi);
    const metric = parseMetric(ing.qty_metric);

    const newDesiValue = desi.value * factor;
    const newMetricValue = metric.value * factor;

    return {
      ...ing,
      qty_desi: formatDesi(newDesiValue, desi.unit),
      qty_metric: `${roundToFive(Math.max(5, newMetricValue))} ${metric.unit}`,
    };
  });
}

/**
 * Returns true when scaling UP (more people than the base recipe).
 * PortionSlider uses this to show the "⚠️ Namak thoda thoda milao" warning.
 */
export function shouldShowScalingWarning(fromSize: number, toSize: number): boolean {
  return toSize > fromSize;
}
