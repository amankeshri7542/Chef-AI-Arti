'use client';

import { useEffect } from 'react';

// Forces the service worker to check for updates on every app open.
// Prevents stale SW serving old JS bundles to mobile PWA users.
export default function SWUpdater() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.update());
      });
    }
  }, []);

  return null;
}
