'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

function HomeIcon({ color }: { color: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>;
}
function SearchIcon({ color }: { color: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>;
}
function CameraIcon({ color }: { color: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8h2.5l1.5-2.5h8L17.5 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/></svg>;
}
function ProfileIcon({ color }: { color: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5"/></svg>;
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
  const activeIndex = ITEMS.findIndex((it) => pathname === it.href || pathname.startsWith(it.href + '/'));

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
      style={{ background: 'linear-gradient(to top, var(--cream) 68%, color-mix(in srgb, var(--cream) 82%, transparent))' }}
    >
      <div
        className="relative mx-auto flex h-[64px] max-w-md items-stretch overflow-hidden rounded-[22px] border"
        style={{
          borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
          background: 'color-mix(in srgb, var(--card) 94%, transparent)',
          boxShadow: '0 12px 34px rgba(73, 36, 16, 0.14)',
          backdropFilter: 'blur(18px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
        }}
      >
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 top-2 rounded-[16px] transition-[left,width] duration-300"
            style={{
              width: `calc(${100 / ITEMS.length}% - 8px)`,
              left: `calc(${(100 / ITEMS.length) * activeIndex}% + 4px)`,
              background: 'var(--hero-lt)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--hero) 10%, transparent)',
              transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
            }}
          />
        )}

        {ITEMS.map((it, i) => {
          const active = i === activeIndex;
          const color = active ? 'var(--hero-dk)' : 'var(--muted)';
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                haptic('tap');
                if (!active) router.prefetch?.(it.href);
              }}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-transform active:scale-[.96]"
            >
              <span className="leading-none transition-transform duration-300" style={{ transform: active ? 'translateY(-1px) scale(1.08)' : 'scale(1)', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' }}>
                <it.Icon color={color} />
              </span>
              <span className="text-[11px] font-semibold tracking-[-0.01em] transition-colors" style={{ color }}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
