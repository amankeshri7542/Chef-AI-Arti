'use client';

import posthog from 'posthog-js';

/** Fire a product analytics event. No-op when PostHog isn't initialised. */
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  try {
    if (posthog.__loaded) posthog.capture(name, properties);
  } catch {
    // analytics must never break the app
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  try {
    if (posthog.__loaded) posthog.identify(userId, traits);
  } catch {
    // ignore
  }
}
