'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fade + translateY page transition.
 * Keyed by pathname so the .page-enter animation replays on every route change.
 * Bottom nav must stay OUTSIDE this wrapper (it lives in the layout).
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Pages must open from the top — never inherit the previous page's scroll.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  // Fallback: if animationend never fires (interrupted/blocked), still drop
  // the class shortly after the 300ms animation window.
  useEffect(() => {
    const t = setTimeout(() => {
      document.getElementById('page-transition-root')?.classList.remove('page-enter');
    }, 500);
    return () => clearTimeout(t);
  }, [pathname]);

  // The class is REMOVED once the entry animation ends: its retained
  // `transform` makes this div a containing block for position:fixed, which
  // pins bottom sheets / modals to the page bottom instead of the viewport
  // (portion-selector "freeze" bug). Keyed remount restores it per navigation.
  return (
    <div
      key={pathname}
      id="page-transition-root"
      className="page-enter"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.classList.remove('page-enter');
        }
      }}
    >
      {children}
    </div>
  );
}
