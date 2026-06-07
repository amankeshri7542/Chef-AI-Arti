import Link from 'next/link';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9]">
      <main className="flex-1 pb-[72px]">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-[72px] items-center justify-around border-t border-[#E8DDD0] bg-[#FFFDF9] px-2">
        <NavItem href="/home" emoji="🏠" label="Ghar" />
        <NavItem href="/search" emoji="🔍" label="Dhundho" />
        <NavItem href="/fridge" emoji="📷" label="Fridge" />
        <NavItem href="/profile" emoji="👤" label="Profile" />
      </nav>
    </div>
  );
}

function NavItem({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-[#8B7355] transition-colors hover:text-[#E8640C]"
    >
      <span className="text-xl leading-none">{emoji}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
