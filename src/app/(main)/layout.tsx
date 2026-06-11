import BottomNav from '@/components/BottomNav/BottomNav';
import Toaster from '@/components/Toaster/Toaster';
import PageTransition from '@/components/PageTransition/PageTransition';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF9]">
      <main className="flex-1 pb-[72px]">
        <PageTransition>{children}</PageTransition>
        <div className="bg-[#FFF8F0] border-t border-[#E8D5C0] py-2 px-4 text-center">
          <p className="text-[10px] text-[#8B6B4A]">
            Built with <span className="text-[#E8640C]">❤️</span> by{' '}
            <a
              href="https://amankeshri.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#E8640C] underline-offset-2 hover:underline"
            >
              Aman
            </a>{' '}
            · Maa ke liye 🍳
          </p>
        </div>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
