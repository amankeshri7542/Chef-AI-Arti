'use client';

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
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
