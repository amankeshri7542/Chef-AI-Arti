type HapticKind = 'tap' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  success: [12, 40, 12],
  warning: [25, 30, 25],
};

/**
 * Fire a short vibration if the device supports it. Safe to call anywhere —
 * no-ops on desktop / unsupported browsers.
 */
export function haptic(kind: HapticKind = 'tap'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // some browsers throw if called without a user gesture — ignore
  }
}
