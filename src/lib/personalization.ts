import type { User } from '@/types/index';

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
