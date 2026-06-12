'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (installed || !installPrompt) return null;

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setInstallPrompt(null);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="flex w-full items-center gap-3 rounded-xl border border-[#E8DDD0] bg-white px-4 py-3"
    >
      <span className="text-xl">📲</span>
      <div className="flex flex-col items-start">
        <span className="text-[13px] font-semibold text-[#1A1A1A]">App install karo</span>
        <span className="text-[13px] text-[#806244]">
          Phone pe save karein — bina browser ke khole
        </span>
      </div>
      <span className="ml-auto text-[13px] font-semibold text-[#BF4E06]">Install →</span>
    </button>
  );
}
