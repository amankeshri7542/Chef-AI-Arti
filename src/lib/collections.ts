export const RECIPE_COLLECTIONS = [
  {
    id: 'top-rated',
    label: 'Top Recipes',
    emoji: '🏆',
    bg: '#FFF0E6',
    filter: { orderBy: 'cooked_count' as const, limit: 20 },
  },
  {
    id: 'jaldi-bane',
    label: 'Jaldi Bane',
    emoji: '⚡',
    bg: '#FFFBEB',
    filter: { tag: 'quick', limit: 20 },
  },
  {
    id: 'vrat-special',
    label: 'Vrat Special',
    emoji: '🕉️',
    bg: '#F0FDF4',
    filter: { is_vrat_friendly: true, limit: 20 },
  },
  {
    id: 'nashta',
    label: 'Nashta',
    emoji: '🍳',
    bg: '#FFF7ED',
    filter: { category: 'nashta', limit: 20 },
  },
  {
    id: 'halka-khana',
    label: 'Halka Khana',
    emoji: '🌿',
    bg: '#F0FDF4',
    filter: { vibe: 'Halki Dish', limit: 20 },
  },
  {
    id: 'meetha',
    label: 'Meetha',
    emoji: '🍬',
    bg: '#FDF4FF',
    filter: { category: 'meetha', limit: 20 },
  },
] as const;

export type CollectionFilter = (typeof RECIPE_COLLECTIONS)[number]['filter'];
