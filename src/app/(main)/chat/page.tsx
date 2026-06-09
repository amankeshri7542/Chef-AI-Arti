import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import BackButton from '@/components/BackButton/BackButton';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';

export default async function ChatPage() {
  const { userId } = await auth();

  let subscriptionStatus: 'free' | 'paid' = 'free';
  if (userId) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('clerk_user_id', userId)
      .single<{ subscription_status: string }>();
    subscriptionStatus = data?.subscription_status === 'paid' ? 'paid' : 'free';
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <div className="flex items-center gap-2 border-b border-[#E8DDD0] bg-white px-4 py-3">
        <BackButton fallback="/home" />
        <p className="text-[14px] font-semibold text-[#1A1A1A]">Chef Arti se baat karo 💬</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="text-[40px]">💬</span>
        <p className="mt-3 text-[15px] font-semibold text-[#1A1A1A]">
          Kisi bhi recipe pe jao aur 💬 button tap karo
        </p>
        <p className="mt-1 text-[12px] text-[#8B7355]">
          Chef Arti se baat karne ke liye — kitne log, kya bacha hai, kaise banaye.
        </p>
        <a
          href="/home"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[#E8640C] px-6 font-semibold text-white"
          style={{ minHeight: 48 }}
        >
          Recipes dekhein →
        </a>
      </div>

      <FloatingChatButton subscriptionStatus={subscriptionStatus} />
    </div>
  );
}
