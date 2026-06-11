'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin', label: '📊 Dashboard' },
  { href: '/admin/recipes', label: '🍲 Recipes' },
  { href: '/admin/users', label: '👥 Users' },
  { href: '/admin/pending', label: '⏳ Pending' },
  { href: '/admin/push', label: '🔔 Push' },
  { href: '/admin/photos', label: '📸 Photos' },
  { href: '/admin/analytics', label: '📈 Analytics' },
];

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Login page renders bare — no sidebar, no cookie required.
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  const navLinks = NAV.map((item) => {
    const active =
      item.href === '/admin'
        ? pathname === '/admin'
        : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="block whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        style={{
          background: active ? '#E8640C' : 'transparent',
          color: active ? '#fff' : '#B8B8D0',
        }}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className="hidden w-56 shrink-0 flex-col gap-1 p-4 md:flex"
        style={{ background: '#16213E' }}
      >
        <div className="mb-6 px-2 pt-2">
          <span className="font-display text-lg font-bold text-white">
            🍳 Chief Arti
          </span>
          <p className="text-xs" style={{ color: '#B8B8D0' }}>
            Admin Panel
          </p>
        </div>
        {navLinks}
        <div className="mt-auto pt-6">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium"
            style={{ background: '#0F3460', color: '#fff' }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="flex items-center gap-2 overflow-x-auto p-3 md:hidden"
        style={{ background: '#16213E' }}
      >
        <span className="shrink-0 pr-2 text-sm font-bold">🍳</span>
        {navLinks}
        <button
          onClick={handleLogout}
          className="shrink-0 rounded-lg px-3 py-2 text-sm"
          style={{ background: '#0F3460', color: '#fff' }}
        >
          🚪
        </button>
      </div>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
