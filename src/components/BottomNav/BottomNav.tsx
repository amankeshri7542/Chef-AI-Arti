'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

const ITEMS = [
  { href: '/home', emoji: '🏠', label: 'Ghar' },
  { href: '/search', emoji: '🔍', label: 'Dhundho' },
  { href: '/fridge', emoji: '📷', label: 'Fridge' },
  { href: '/profile', emoji: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = ITEMS.findIndex(
    (it) => pathname === it.href || pathname.startsWith(it.href + '/'),
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 h-[72px] border-t border-[#E8DDD0] bg-[#FFFDF9]">
      <div className="relative mx-auto flex h-full max-w-md items-stretch">
        {/* Sliding active pill */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-2 h-[52px] rounded-2xl transition-[left] duration-300"
            style={{
              width: `${100 / ITEMS.length}%`,
              left: `${(100 / ITEMS.length) * activeIndex}%`,
              background: '#FFF0E6',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
            }}
          />
        )}

        {ITEMS.map((it, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => {
                haptic('tap');
                if (active) return;
                router.prefetch?.(it.href);
              }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5"
            >
              <span
                className="text-xl leading-none transition-transform duration-200"
                style={{ transform: active ? 'scale(1.18)' : 'scale(1)' }}
              >
                {it.emoji}
              </span>
              <span
                className="text-[10px] font-medium transition-colors"
                style={{ color: active ? '#E8640C' : '#8B7355' }}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
