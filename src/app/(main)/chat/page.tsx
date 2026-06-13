import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import BackButton from '@/components/BackButton/BackButton';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import Icon from '@/components/editorial/Icon';

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
    <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
      <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
        <div>
          <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Aapki Chef Arti</div>
          <h1 className="t-display" style={{ fontSize: 20, margin: 0, color: 'var(--text)' }}>Koi bhi sawaal poochho</h1>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px 24px' }}>
        <span style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chat" size={36} color="var(--hero-dk)" />
        </span>
        <h2 className="t-display" style={{ fontSize: 21, margin: '16px 0 6px', color: 'var(--text)' }}>Arti hamesha aapke saath</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.55 }}>
          Niche 💬 button tap karke poochho — kitne log, kya bacha hai, kaise banaye.
        </p>
        <a
          href="/home"
          className="r-cta tap-spring"
          style={{ marginTop: 22, maxWidth: 260, textDecoration: 'none' }}
        >
          Recipes dekhein <Icon name="chevR" size={18} color="#fff" />
        </a>
      </div>

      <FloatingChatButton subscriptionStatus={subscriptionStatus} />
    </div>
  );
}
