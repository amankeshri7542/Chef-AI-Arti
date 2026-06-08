export const RATE_LIMITS = {
  free: {
    chat: 3,
    scan: 2,
    recipes: 10,
    'ai-gen': 1,
  },
  paid: {
    chat: 20,
    scan: 10,
    recipes: 100,
    'ai-gen': 5,
  },
} as const;
