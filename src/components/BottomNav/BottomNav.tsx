'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

// SVG icons instead of emoji — emoji glyphs render inconsistently across
// Android OEM keyboards/fonts (some colored, some greyscale outlines).
function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function CameraIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h2.5l1.5-2.5h8L17.5 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5" />
    </svg>
  );
}

const ITEMS = [
  { href: '/home', Icon: HomeIcon, label: 'Ghar' },
  { href: '/search', Icon: SearchIcon, label: 'Dhundho' },
  { href: '/fridge', Icon: CameraIcon, label: 'Fridge' },
  { href: '/profile', Icon: ProfileIcon, label: 'Profile' },
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
          const color = active ? '#E8640C' : '#806244';
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
                className="leading-none transition-transform duration-200"
                style={{ transform: active ? 'scale(1.12)' : 'scale(1)' }}
              >
                <it.Icon color={color} />
              </span>
              <span
                className="text-[12px] font-medium transition-colors"
                style={{ color }}
              >
                {it.label}
              </span>
              <span
                aria-hidden
                className="h-1 w-1 rounded-full transition-opacity duration-200"
                style={{ background: '#E8640C', opacity: active ? 1 : 0 }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
