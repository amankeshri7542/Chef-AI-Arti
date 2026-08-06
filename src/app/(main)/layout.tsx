import BottomNav from '@/components/BottomNav/BottomNav';
import Toaster from '@/components/Toaster/Toaster';
import PageTransition from '@/components/PageTransition/PageTransition';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white focus:not-sr-only"
      >
        Main content par jaayein
      </a>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
