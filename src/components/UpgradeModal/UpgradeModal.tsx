'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BENEFITS = [
  { icon: '📷', text: 'Fridge scan — roz 10 baar' },
  { icon: '💬', text: 'Chef Arti se 20 sawaal/din' },
  { icon: '🍱', text: 'Bacha Hua mode — leftovers into meals' },
  { icon: '📐', text: '15 logon tak ka portion' },
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
          className="animate-fade-in-up w-full max-w-md"
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
                  <h2 className="font-display text-center text-[22px]" style={{ color: 'var(--terracotta)' }}>
                    Aap Premium Member ban gayin! 👑
                  </h2>
                  <p
                    className="mt-2 text-center text-[13px]"
                    style={{ color: 'var(--muted)', lineHeight: 1.6 }}
                  >
                    Ab Chef Arti hamesha aapke saath hai — koi limit nahi, koi rukawat nahi 🍳
                  </p>

                  <button
                    type="button"
                    onClick={goHome}
                    className="mt-5 flex w-full items-center justify-center rounded-[16px] text-[15px] font-semibold text-white"
                    style={{
                      height: 56,
                      background: 'linear-gradient(135deg, #E8640C, #C4621E)',
                      boxShadow: '0 6px 24px rgba(180,80,20,0.25)',
                    }}
                  >
                    Theek hai, ghar chalein! →
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
                <span className="text-[40px] leading-none">👑</span>
                <h2 className="font-display mt-2 text-center text-[22px]" style={{ color: 'var(--terracotta)' }}>
                  Premium Member bano
                </h2>
                <p className="mt-1 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
                  Unlimited Chef Arti — jab chahein, jitna chahein
                </p>
              </div>

              {/* Benefits */}
              <div className="mt-5">
                {BENEFITS.map((b, i) => (
                  <div
                    key={b.text}
                    className="flex items-center gap-3 py-3"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                  >
                    <span className="text-[20px] leading-none">{b.icon}</span>
                    <span className="flex-1 text-[13px]" style={{ color: 'var(--text)' }}>{b.text}</span>
                    <span className="text-[16px]" style={{ color: 'var(--green)' }}>✓</span>
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="mt-4 text-center">
                <span className="font-display text-[36px]" style={{ color: 'var(--saffron)' }}>₹150</span>
                <span className="ml-1 text-[14px]" style={{ color: 'var(--muted)' }}>/mahine</span>
                <p className="mt-0.5 text-[13px] italic" style={{ color: 'var(--muted)' }}>= ek pizza ki kimat 🍕</p>
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={() => setCheckoutStarted(true)}
                className="font-display mt-5 flex w-full items-center justify-center text-[16px] text-white"
                style={{
                  height: 56,
                  background: 'linear-gradient(135deg, #E8640C, #C4621E)',
                  borderRadius: 16,
                  boxShadow: '0 6px 24px rgba(180,80,20,0.25)',
                }}
              >
                Abhi Premium lo 🌟
              </button>
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
