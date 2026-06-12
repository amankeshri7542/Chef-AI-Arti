export const RATE_LIMITS = {
  free: {
    chat: 3,
    scan: 2,
    recipes: 10,
    'ai-gen': 1,
    // validate is a vision call too — counted separately from scan (which is
    // only consumed on successful extraction) so retries can't run unmetered
    validate: 6,
    // per-IP daily cap on guest vector searches (embedding cost, public route)
    'guest-search': 30,
  },
  paid: {
    chat: 20,
    scan: 10,
    recipes: 100,
    'ai-gen': 5,
    validate: 30,
    'guest-search': 30,
  },
} as const;
