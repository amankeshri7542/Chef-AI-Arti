'use client';

import { useEffect, useState } from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed so it's fresh next open
      setSuccess(false);
      setError(null);
      setLoading(false);
      return;
    }

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered card */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-5"
        role="dialog"
        aria-modal="true"
        aria-label="Premium upgrade"
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          {loading && (
            <div className="flex flex-col items-center gap-4 py-6">
              {/* Spinner */}
              <div
                className="h-10 w-10 rounded-full border-4 border-[#E8DDD0] border-t-[#E8640C]"
                style={{ animation: 'spin 0.8s linear infinite' }}
                aria-label="Loading"
              />
              <p className="text-[14px] font-medium text-[#8B7355]">
                Payment taiyaar ho rahi hai...
              </p>
            </div>
          )}

          {!loading && success && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-5xl">🎉</div>
              <p className="text-center text-[16px] font-bold text-[#1A1A1A]">
                Premium ho gaye!
              </p>
              <p className="text-center text-[13px] text-[#8B7355]">
                Page refresh karein sabhi features unlock karne ke liye.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#E8640C] text-[15px] font-bold text-white"
              >
                Refresh karein ✨
              </button>
            </div>
          )}

          {!loading && !success && error && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-4xl">😕</div>
              <p className="text-center text-[14px] text-[#BF4E06]">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-[#E8DDD0] text-[14px] font-medium text-[#1A1A1A]"
              >
                Theek hai, baad mein
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
