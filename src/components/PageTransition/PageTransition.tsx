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

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
