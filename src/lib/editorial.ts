// editorial.ts — helpers for the Session-39 "Modern Rasoi Editorial" layer.
// Derives DishArt fallback art (warm gradient hue + stroke icon) from a recipe,
// so recipes with no thumbnail get a tasteful illustrated placeholder instead
// of the old emoji-on-flat-gradient look.

import type { IconName } from '@/components/editorial/Icon';

type DishLike = {
  id?: string;
  category?: string | null;
};

// Per-category base hue (warm-leaning) + the stroke icon that reads as that dish.
const CATEGORY_ART: Record<string, { hue: number; icon: IconName }> = {
  sabzi: { hue: 96, icon: 'pan' }, // greens
  dal: { hue: 50, icon: 'pot' }, // golden
  roti: { hue: 30, icon: 'sun' }, // tan flatbread
  chawal: { hue: 44, icon: 'pot' }, // cream rice
  nashta: { hue: 40, icon: 'sun' }, // golden
  meetha: { hue: 36, icon: 'sweet' }, // warm sweet
};

const FALLBACK_ART = { hue: 30, icon: 'pot' as IconName };

/** Stable small jitter (0–17) from an id so same-category cards aren't identical. */
function idJitter(id?: string): number {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 18;
}

export function dishArt(recipe: DishLike): { hue: number; icon: IconName } {
  const base = (recipe.category && CATEGORY_ART[recipe.category]) || FALLBACK_ART;
  return { hue: base.hue + idJitter(recipe.id), icon: base.icon };
}
