import BottomNav from '@/components/BottomNav/BottomNav';
import Toaster from '@/components/Toaster/Toaster';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9]">
      <main className="flex-1 pb-[72px]">{children}</main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
