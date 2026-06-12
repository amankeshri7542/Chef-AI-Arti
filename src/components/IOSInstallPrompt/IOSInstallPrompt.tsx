'use client';

import { useState, useEffect } from 'react';

/**
 * iOS Safari "Add to Home Screen" instructions.
 * Shows a dismissible first-visit banner (localStorage-gated) and is also
 * rendered inline in Profile (always visible for iOS Safari users).
 *
 * Does NOT render on:
 * - Android / desktop (they get the native beforeinstallprompt)
 * - Already-installed PWA (standalone mode)
 * - Non-Safari browsers on iOS (Chrome/Firefox iOS can't install PWAs)
 */

function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  // @ts-expect-error — navigator.standalone is Safari-only
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return isIOS && isSafari && !isStandalone;
}

const DISMISS_KEY = 'ios-install-dismissed';

/** First-visit dismissible banner for home page */
export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIOSSafari() && !localStorage.getItem(DISMISS_KEY)) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  }

  return (
    <div
      className="mx-4 mt-3 rounded-2xl px-4 py-4"
      style={{ background: '#FFF0E6', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[14px] font-bold" style={{ color: 'var(--terracotta)' }}>
          📱 iPhone pe install karein!
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[16px]"
          style={{ color: 'var(--muted)', background: 'rgba(0,0,0,0.05)', minHeight: 28, minWidth: 28 }}
          aria-label="Band karein"
        >
          ✕
        </button>
      </div>
      <InstallSteps />
    </div>
  );
}

/** Persistent Profile section — always visible for iOS Safari users */
export function IOSInstallProfileSection() {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(isIOSSafari());
  }, []);

  if (!isIOS) return null;

  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: 'var(--border)', background: '#FFFFFF' }}
    >
      <p className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
        📱 iPhone pe install karein
      </p>
      <InstallSteps />
    </div>
  );
}

/** Shared step-by-step instructions */
function InstallSteps() {
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <Step
        number={1}
        icon="⬆️"
        text="Safari mein neeche Share button dabaein"
        detail="(Square icon with arrow ⬆️)"
      />
      <Step
        number={2}
        icon="📜"
        text="Neeche scroll karein"
        detail="List mein dhundhein..."
      />
      <Step
        number={3}
        icon="➕"
        text={'"Add to Home Screen" pe tap karein'}
        detail="Phir 'Add' dabaein — bas!"
      />
      <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
        App icon Home Screen pe aa jayega — bina browser ke kholein! 🎉
      </p>
    </div>
  );
}

function Step({ number, icon, text, detail }: { number: number; icon: string; text: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: 'var(--saffron, #E8640C)' }}
      >
        {number}
      </span>
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
          {icon} {text}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{detail}</p>
      </div>
    </div>
  );
}
