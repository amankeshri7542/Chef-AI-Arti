import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import BackButton from '@/components/BackButton/BackButton';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import Icon, { type IconName } from '@/components/editorial/Icon';

const PROMPTS: Array<{ icon: IconName; title: string; copy: string }> = [
  { icon: 'pot', title: 'Aaj kya banao?', copy: 'Ghar ke ingredients se jaldi ideas' },
  { icon: 'thali', title: 'Meal plan banao', copy: 'Breakfast se dinner tak poora plan' },
  { icon: 'camera', title: 'Bacha hua use karo', copy: 'Leftovers ko nayi dish mein badlo' },
];

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
    <div className="arti-stage">
      <header
        className="sticky top-0 z-10"
        style={{ borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Aapki personal kitchen guide</div>
          <h1 className="t-display" style={{ fontSize: 20, margin: 0, color: 'var(--text)' }}>Chef Arti</h1>
        </div>
        <span className="r-pill" style={{ height: 34, color: 'var(--green)', background: 'var(--green-lt)' }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} /> Online
        </span>
      </header>

      <main style={{ padding: '42px 20px 112px' }}>
        <section className="card-entry" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="arti-orb">
            <Icon name="chat" size={46} color="var(--hero-dk)" />
          </div>
          <div className="t-overline" style={{ marginTop: 24, color: 'var(--hero-dk)' }}>Sawaal chhota ho ya dinner ka crisis</div>
          <h2 className="t-display" style={{ fontSize: 31, lineHeight: 1.12, margin: '8px 0 10px', color: 'var(--text)', maxWidth: 360 }}>
            Rasoi mein ab aap akeli nahi hain
          </h2>
          <p style={{ fontSize: 14.5, color: 'var(--muted)', maxWidth: 340, lineHeight: 1.65, margin: 0 }}>
            Ingredients, timing, substitutions, bachchon ka taste ya poore hafte ka plan. Arti se normal Hinglish mein poochhiye.
          </p>
        </section>

        <section className="r-card card-entry stg-2" style={{ marginTop: 30, padding: 16, background: 'color-mix(in srgb, var(--card) 94%, transparent)' }}>
          <div className="t-overline" style={{ color: 'var(--muted)', padding: '2px 4px 12px' }}>Try asking</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {PROMPTS.map((prompt) => (
              <div key={prompt.title} className="arti-prompt">
                <span style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--hero-lt)' }}>
                  <Icon name={prompt.icon} size={21} color="var(--hero-dk)" />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', color: 'var(--text)', fontWeight: 600, fontSize: 14.5 }}>{prompt.title}</span>
                  <span className="t-caption">{prompt.copy}</span>
                </span>
                <Icon name="chevR" size={18} color="var(--muted)" />
              </div>
            ))}
          </div>
        </section>

        <div className="card-entry stg-3" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', fontSize: 12.5 }}>
          <span aria-hidden>✨</span>
          Tap the chat button below to start
        </div>
      </main>

      <FloatingChatButton subscriptionStatus={subscriptionStatus} />
    </div>
  );
}
