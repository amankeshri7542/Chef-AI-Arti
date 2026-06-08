'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = 'idle' | 'loading' | 'subscribed' | 'denied' | 'error' | 'unsupported';

export default function PushNotificationButton() {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    // Already subscribed?
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus('subscribed');
      })
      .catch(() => {});
  }, []);

  async function handleSubscribe() {
    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus('error');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'unsupported') return null;

  if (status === 'subscribed') {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-center">
        <p className="text-[13px] font-medium text-green-700">
          🔔 Subah Arti yaad dilaayegi! ☀️
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-3">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={status === 'loading' || status === 'denied'}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E8640C] text-[14px] font-bold text-white disabled:opacity-50"
      >
        {status === 'loading' ? 'Chalu kar rahe hain...' : '🔔 Notifications chalao'}
      </button>
      {status === 'denied' && (
        <p className="mt-2 text-[12px] text-[#BF4E06]">
          Notifications band hain — phone settings se allow karein.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-[12px] text-[#BF4E06]">Kuch gadbad ho gayi, dobara try karein.</p>
      )}
    </div>
  );
}
