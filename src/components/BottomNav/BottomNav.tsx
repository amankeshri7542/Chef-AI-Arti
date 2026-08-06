'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

function HomeIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" fill={active ? color : 'none'} />
    </svg>
  );
}

function SearchIcon({ color }: { color: string; active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function CameraIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill={active ? 'color-mix(in srgb, var(--hero) 16%, transparent)' : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h2.5l1.5-2.5h8L17.5 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

function ProfileIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" fill={active ? color : 'none'} />
      <path d="M4.5 20.5c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5" />
    </svg>
  );
}

const ITEMS = [
  { href: '/home', Icon: HomeIcon, label: 'Ghar', aria: 'Home' },
  { href: '/search', Icon: SearchIcon, label: 'Khoj', aria: 'Recipe search' },
  { href: '/fridge', Icon: CameraIcon, label: 'Scan', aria: 'Fridge scan' },
  { href: '/profile', Icon: ProfileIcon, label: 'Aap', aria: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = ITEMS.findIndex((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
      style={{ background: 'linear-gradient(to top, var(--cream) 70%, color-mix(in srgb, var(--cream) 76%, transparent))' }}
    >
      <div
        className="relative mx-auto flex h-[66px] max-w-md items-stretch overflow-hidden rounded-[23px] border"
        style={{
          borderColor: 'color-mix(in srgb, var(--border) 86%, transparent)',
          background: 'color-mix(in srgb, var(--card) 94%, transparent)',
          boxShadow: '0 14px 38px rgba(73, 36, 16, 0.16), inset 0 1px 0 rgba(255,255,255,.8)',
          backdropFilter: 'blur(20px) saturate(1.22)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.22)',
        }}
      >
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 top-2 rounded-[17px] transition-[left,width] duration-300"
            style={{
              width: `calc(${100 / ITEMS.length}% - 8px)`,
              left: `calc(${(100 / ITEMS.length) * activeIndex}% + 4px)`,
              background: 'linear-gradient(145deg, var(--hero-lt), color-mix(in srgb, var(--hero-lt) 60%, white))',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--hero) 12%, transparent), 0 5px 14px rgba(95,45,17,.05)',
              transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
            }}
          />
        )}

        {ITEMS.map((item, index) => {
          const active = index === activeIndex;
          const color = active ? 'var(--hero-dk)' : 'var(--muted)';
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.aria}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                haptic('tap');
                if (!active) router.prefetch?.(item.href);
              }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-transform active:scale-[.96]"
            >
              <span
                className="leading-none transition-transform duration-300"
                style={{
                  transform: active ? 'translateY(-1px) scale(1.08)' : 'scale(1)',
                  transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                }}
              >
                <item.Icon color={color} active={active} />
              </span>
              <span className="text-[11px] font-semibold tracking-[-0.01em] transition-colors" style={{ color }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
