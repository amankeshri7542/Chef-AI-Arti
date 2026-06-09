'use client';

import { useEffect, useState, useCallback } from 'react';
import { TOAST_EVENT, type ToastPayload } from '@/lib/toast';

interface ActiveToast extends ToastPayload {
  leaving?: boolean;
}

const TONE_STYLE: Record<ToastPayload['tone'], { bg: string; border: string; emoji: string }> = {
  info: { bg: '#FFFFFF', border: '#E8DDD0', emoji: '💬' },
  success: { bg: '#F0FAF4', border: '#9FE1CB', emoji: '✅' },
  error: { bg: '#FFF3EC', border: '#FBC08A', emoji: '😕' },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      setToasts((prev) => [...prev, detail]);
      setTimeout(() => dismiss(detail.id), detail.duration);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const tone = TONE_STYLE[t.tone];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-left shadow-[0_6px_20px_rgba(180,80,20,0.18)] ${
              t.leaving ? 'animate-toast-out' : 'animate-toast-in'
            }`}
            style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
          >
            <span className="text-[18px] leading-none">{tone.emoji}</span>
            <span className="flex-1 text-[13px] font-medium text-[#2C1810]">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
