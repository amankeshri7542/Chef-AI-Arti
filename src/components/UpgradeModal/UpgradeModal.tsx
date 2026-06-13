'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon, { type IconName } from '@/components/editorial/Icon';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BENEFITS: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'chat', title: 'Unlimited Chef Arti', sub: 'Jitna poochho, koi limit nahi' },
  { icon: 'camera', title: 'Roz fridge scan', sub: 'Jo hai, usi se recipe' },
  { icon: 'share', title: 'WhatsApp par share', sub: 'Recipe parivar ko bhejo' },
  { icon: 'sparkle', title: 'Aapke liye nayi recipes', sub: 'Arti khaas aapke liye banaye' },
];

const BURST_EMOJIS: { emoji: string; x: number; y: number }[] = [
  { emoji: '🎉', x: -120, y: -120 },
  { emoji: '👑', x: 120, y: -120 },
  { emoji: '🍳', x: -140, y: 40 },
  { emoji: '✨', x: 140, y: 40 },
  { emoji: '🥘', x: -80, y: 140 },
  { emoji: '🌟', x: 80, y: 140 },
];

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const router = useRouter();
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSuccessText, setShowSuccessText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when closed so it's fresh next open
  useEffect(() => {
    if (!isOpen) {
      setCheckoutStarted(false);
      setSuccess(false);
      setShowSuccessText(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Kick off Razorpay only once the user taps the CTA
  useEffect(() => {
    if (!isOpen || !checkoutStarted) return;

    setLoading(true);
    setError(null);

    // Step 1: Create subscription on the server
    fetch('/api/subscription/create', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json() as {
          subscriptionId?: string;
          razorpayKeyId?: string;
          amount?: number;
          currency?: string;
          name?: string;
          description?: string;
          error?: string;
        };

        if (res.status === 400 && data.error?.includes('already premium')) {
          setError('Aap already premium hain! 🎉');
          setLoading(false);
          return;
        }

        if (!res.ok || !data.subscriptionId || !data.razorpayKeyId) {
          setError(data.error ?? 'Kuch gadbad ho gayi. Dobara try karein.');
          setLoading(false);
          return;
        }

        // Step 2: Load Razorpay checkout.js dynamically
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
          setLoading(false);

          // Step 3: Open Razorpay modal
          const rzp = new (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay({
            key: data.razorpayKeyId,
            subscription_id: data.subscriptionId,
            name: 'Chief-AI-Arti',
            description: 'Unlimited khana, unlimited sawaal! 🍳',
            theme: { color: '#E8640C' },
            handler: function () {
              setSuccess(true);
            },
            modal: {
              ondismiss: () => onClose(),
            },
          });
          rzp.open();
        };

        script.onerror = () => {
          setLoading(false);
          setError('Checkout load nahi hua. Network check karein.');
        };
      })
      .catch(() => {
        setLoading(false);
        setError('Network error. Dobara try karein.');
      });
  }, [isOpen, checkoutStarted, onClose]);

  // Success: reveal text after burst, auto-close after 5s
  useEffect(() => {
    if (!success) return;
    const t1 = setTimeout(() => setShowSuccessText(true), 600);
    const t2 = setTimeout(() => goHome(), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  function goHome() {
    onClose();
    router.push('/home');
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={success ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Premium upgrade"
      >
        <div
          className="animate-sheet-spring w-full max-w-md"
          style={{
            background: 'var(--cream)',
            borderRadius: '24px 24px 0 0',
            padding: '24px 20px 32px',
            boxShadow: '0 -8px 32px rgba(180,80,20,0.18)',
          }}
        >
          {/* Handle bar */}
          <div className="mx-auto mb-4 h-1 w-8 rounded-full" style={{ background: 'var(--border)' }} />

          {/* ───── SUCCESS STATE ───── */}
          {success ? (
            <div className="relative flex flex-col items-center pb-2 pt-4">
              {/* Emoji burst */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {BURST_EMOJIS.map((b, i) => (
                  <span
                    key={i}
                    className="absolute text-[32px]"
                    style={{
                      // @ts-expect-error CSS custom props
                      '--burst-x': `${b.x}px`,
                      '--burst-y': `${b.y}px`,
                      animation: 'emojiBurst 0.8s ease-out forwards',
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    {b.emoji}
                  </span>
                ))}
              </div>

              {showSuccessText && (
                <div className="flex flex-col items-center">
                  <span style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: '0 10px 30px -8px rgba(45,106,79,0.5)' }}>
                    <Icon name="check" size={38} color="#fff" sw={2.6} />
                  </span>
                  <h2 className="t-display text-center" style={{ fontSize: 26, color: 'var(--text)' }}>
                    Aap Premium hain! 🎉
                  </h2>
                  <p className="mt-2 text-center text-[13.5px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                    Ab Chef Arti hamesha aapke saath hai — koi limit nahi, koi rukawat nahi 🍳
                  </p>

                  <button type="button" onClick={goHome} className="r-cta tap-spring mt-5">
                    Chalo, kuch banayein <Icon name="chevR" size={18} color="#fff" />
                  </button>

                  {/* Countdown progress bar */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--saffron-lt)' }}>
                    <div
                      className="h-full"
                      style={{ background: 'var(--saffron)', animation: 'drainBar 5s linear forwards' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : loading ? (
            /* ───── LOADING ───── */
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                className="h-10 w-10 rounded-full border-4 border-[#E8DDD0] border-t-[#E8640C]"
                style={{ animation: 'spin 0.8s linear infinite' }}
                aria-label="Loading"
              />
              <p className="text-[14px] font-medium" style={{ color: 'var(--muted)' }}>
                Payment taiyaar ho rahi hai...
              </p>
            </div>
          ) : error ? (
            /* ───── ERROR ───── */
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-4xl">😕</div>
              <p className="text-center text-[14px]" style={{ color: 'var(--saffron-dk)' }}>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 flex w-full items-center justify-center rounded-[12px] text-[14px] font-medium"
                style={{ height: 52, border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                Theek hai, baad mein
              </button>
            </div>
          ) : (
            /* ───── DEFAULT (offer) ───── */
            <div className="relative">
              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                className="absolute -top-1 right-0 flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px]"
                style={{ color: 'var(--muted)' }}
                aria-label="Band karo"
              >
                ✕
              </button>

              {/* Header */}
              <div className="flex flex-col items-center">
                <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--hero-lt)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon name="sparkle" size={30} color="var(--hero-dk)" />
                </span>
                <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Arti Premium</div>
                <h2 className="t-display mt-1 text-center" style={{ fontSize: 24, color: 'var(--text)' }}>
                  Premium Member bano
                </h2>
                <p className="mt-1 text-center text-[13.5px]" style={{ color: 'var(--muted)' }}>
                  Chai ke ek cup se kam mein, poora saal ka saath ☕
                </p>
              </div>

              {/* Benefits */}
              <div className="r-card mt-5" style={{ padding: '4px 4px' }}>
                {BENEFITS.map((b, i) => (
                  <div
                    key={b.title}
                    className="flex items-center gap-3.5"
                    style={{ padding: '12px 12px', borderBottom: i < BENEFITS.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={b.icon} size={20} color="var(--hero-dk)" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[14.5px] font-semibold" style={{ color: 'var(--text)' }}>{b.title}</span>
                      <span className="t-caption">{b.sub}</span>
                    </span>
                    <Icon name="check" size={18} color="var(--green)" sw={2.4} />
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="t-display" style={{ fontSize: 40, color: 'var(--text)' }}>₹150</span>
                <span className="text-[15px]" style={{ color: 'var(--muted)' }}>/ mahina</span>
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={() => setCheckoutStarted(true)}
                className="r-cta tap-spring mt-5"
              >
                <Icon name="lock" size={18} color="#fff" /> Razorpay se ₹150 dein
              </button>
              <p className="t-caption text-center" style={{ marginTop: 10 }}>Kabhi bhi cancel kar sakti hain · UPI / Card / Netbanking</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
