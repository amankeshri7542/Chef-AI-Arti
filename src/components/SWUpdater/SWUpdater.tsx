'use client';

import { useEffect } from 'react';

// Check for a new service worker whenever the app opens. When the new worker
// takes control, reload once so an already-open custom-domain tab cannot keep
// rendering stale Next.js chunks after a production deployment.
export default function SWUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;

    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.update())))
      .catch((error: unknown) => {
        console.warn('[service-worker] update check failed', error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
