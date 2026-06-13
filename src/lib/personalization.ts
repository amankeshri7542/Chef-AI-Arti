import type { User } from '@/types/index';

// ─── Segment context (shared across users in the same diet+region bucket) ─────

export interface SegmentInput {
  diet_type: string;
  preferred_region: string | null;
  spice_preference: string;
}

const DIET_RESTRICTIONS: Record<string, string> = {
  veg: 'Vegetarian — no meat, poultry, eggs, or non-veg stock',
  'non-veg': 'Non-vegetarian — meat, poultry, and seafood are allowed',
  eggetarian: 'Eggetarian — eggs and vegetarian ingredients only; no meat or poultry',
  vegan: 'Vegan — no dairy, eggs, honey, or any animal product; use plant-based alternatives (e.g. coconut milk for cream, oil for ghee)',
  jain: 'Jain — STRICT: NO root vegetables in any form (onion, garlic, potato, carrot, radish, beet, ginger root, leek, spring-onion bulbs). Use hing (asafoetida) where onion/garlic would be used. No eggs.',
};

const REGION_GUIDANCE: Record<string, string[]> = {
  'south-indian': [
    'Regional style: South Indian',
    '  - Tempering (tadka): mustard seeds, curry leaves (kadi patta), dried red chillies, urad dal, chana dal',
    '  - Key ingredients: coconut (grated/milk/oil), tamarind, curry leaves, sambar powder where authentic',
    '  - Prefer coconut oil or groundnut oil over ghee for neutral/savoury dishes',
    '  - Idli/dosa batter, rasam, sambar conventions apply to the respective dishes',
  ],
  'bengali': [
    'Regional style: Bengali',
    '  - Tempering: panch phoron (5-spice: fenugreek, nigella, cumin, black mustard, fennel)',
    '  - Primary fat: mustard oil (sarso tel) — authentic Bengali cooking uses it generously',
    '  - Key ingredients: mustard paste, poppy seeds (posto/khus-khus), nigella (kalonji)',
    '  - For non-veg: fish (rohu, hilsa) and prawns are central; hilsa conventions apply',
  ],
  'gujarati': [
    'Regional style: Gujarati',
    '  - Signature balance: slight sweet-sour (khatti-meethi) — a pinch of sugar/jaggery in dals and sabzi',
    '  - Tempering: mustard seeds, curry leaves, hing; groundnut oil preferred',
    '  - Key ingredients: peanuts, sesame seeds, besan (gram flour); sourness from tamarind or lemon',
    '  - Lighter chilli heat than north-Indian standard; gentle flavours overall',
  ],
  'maharashtrian': [
    'Regional style: Maharashtrian',
    '  - Use goda masala or kala masala for curries where authentic',
    '  - Key ingredients: peanuts, sesame seeds, dry coconut, kokum (for sourness), coriander-heavy',
    '  - Tempering: mustard seeds, curry leaves, hing',
    '  - For non-veg: Kolhapuri spice blend, tambda/pandhra rassa conventions apply',
  ],
};

/**
 * Builds a compact segment-level context block for the CASE-2 extraction prompt.
 * This is shared across ALL users in the same (diet_type × preferred_region) segment —
 * do NOT include user-specific fields (family_size, cooking_skill, etc.) here.
 * Returns empty string for the default (veg, pan-north-indian, medium) segment.
 */
export function buildSegmentContext(seg: SegmentInput): string {
  const lines: string[] = ['[Segment context — recipe extraction guidance]'];

  // Diet
  const dietLine = DIET_RESTRICTIONS[seg.diet_type];
  if (dietLine) lines.push(`Diet: ${dietLine}`);

  // Region
  const region = seg.preferred_region;
  if (region && region !== 'pan-north-indian') {
    const guidance = REGION_GUIDANCE[region];
    if (guidance) {
      lines.push(...guidance);
    } else {
      lines.push(`Regional style: ${region} — adapt techniques and spices to match this regional cooking tradition`);
    }
  }

  // Spice
  if (seg.spice_preference === 'mild') {
    lines.push('Spice level: MILD — reduce chilli (lal mirch, hari mirch) significantly; keep flavour but minimal heat');
  } else if (seg.spice_preference === 'hot') {
    lines.push('Spice level: HOT — increase chilli and spice for a properly teekha result');
  }

  // Invariant closing instruction
  lines.push(
    'Adapt ingredients/substitutions/techniques to match this segment WITHOUT changing the dish\'s core identity or name.',
  );

  // Only emit if there is meaningful content (i.e. non-default segment)
  const hasNonDefault =
    seg.diet_type !== 'veg' ||
    (region && region !== 'pan-north-indian') ||
    (seg.spice_preference && seg.spice_preference !== 'medium');

  return hasNonDefault ? lines.join('\n') : '';
}

/** Canonical segment key for dedup: "diet_type|preferred_region" */
export function makeSegmentKey(dietType: string, preferredRegion: string | null): string {
  return `${dietType ?? 'veg'}|${preferredRegion ?? 'pan-north-indian'}`;
}

const DIET_LABELS: Record<string, string> = {
  veg: 'Vegetarian',
  'non-veg': 'Non-vegetarian',
  eggetarian: 'Eggetarian',
  vegan: 'Vegan',
  jain: 'Jain',
};

const SKILL_LABELS: Record<string, string> = {
  beginner: 'beginner cook (simple steps, avoid complex techniques)',
  intermediate: 'intermediate cook',
  advanced: 'advanced cook (can handle complex techniques)',
};

const TIME_LABELS: Record<string, string> = {
  '15min': 'prefers quick recipes (under 15 minutes)',
  '30min': 'prefers recipes under 30 minutes',
  'any': 'okay with any cooking duration',
};

const COOKING_FOR_LABELS: Record<string, string> = {
  alone: 'cooking for themselves',
  couple: 'cooking for 2 people',
  family: 'cooking for a family',
  pg: 'cooking for PG/hostel (batch cooking)',
};

/**
 * Returns a compact, human-readable personalization block for LLM system prompts.
 * The output is additive — safe to append to any existing prompt context.
 * Omits fields that are null/default/unknown so the block stays concise.
 */
export function buildPersonalizationContext(
  user: Pick<
    User,
    | 'diet_type'
    | 'spice_preference'
    | 'preferred_region'
    | 'cooking_skill'
    | 'time_preference'
    | 'kitchen_setup'
    | 'is_vrat_mode'
    | 'cooking_for'
    | 'family_size'
  >,
): string {
  const lines: string[] = [];

  if (user.diet_type) {
    lines.push(`Diet: ${DIET_LABELS[user.diet_type] ?? user.diet_type}`);
  }

  if (user.family_size && user.family_size > 1) {
    const cookingFor = user.cooking_for
      ? (COOKING_FOR_LABELS[user.cooking_for] ?? `cooking for ${user.family_size} people`)
      : `cooking for ${user.family_size} people`;
    lines.push(`Family: ${cookingFor} (${user.family_size} log)`);
  }

  if (user.spice_preference && user.spice_preference !== 'medium') {
    lines.push(
      `Spice: prefers ${user.spice_preference === 'mild' ? 'kam teekha (mild)' : 'zyada teekha (hot)'}`,
    );
  }

  if (user.preferred_region && user.preferred_region !== 'pan-north-indian') {
    lines.push(`Region: ${user.preferred_region} cuisine preferred`);
  }

  if (user.is_vrat_mode) {
    lines.push('Vrat: currently observing vrat — only vrat-friendly dishes');
  }

  if (user.cooking_skill && user.cooking_skill !== 'intermediate') {
    lines.push(`Skill: ${SKILL_LABELS[user.cooking_skill] ?? user.cooking_skill}`);
  }

  if (user.time_preference && user.time_preference !== 'any') {
    lines.push(`Time: ${TIME_LABELS[user.time_preference] ?? user.time_preference}`);
  }

  const equipment = user.kitchen_setup?.filter(Boolean) ?? [];
  if (equipment.length > 0 && equipment.length < 5) {
    lines.push(`Equipment: ${equipment.join(', ')}`);
  }

  if (lines.length === 0) return '';

  return `\n[User preferences]\n${lines.join('\n')}`;
}
