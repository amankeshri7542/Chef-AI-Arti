import BottomNav from '@/components/BottomNav/BottomNav';
import Toaster from '@/components/Toaster/Toaster';
import PageTransition from '@/components/PageTransition/PageTransition';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9]">
      <main className="flex-1 pb-[72px]">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
