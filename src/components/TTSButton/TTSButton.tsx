'use client';

import { useState, useRef } from 'react';

interface TTSButtonProps {
  text: string;
}

export default function TTSButton({ text }: TTSButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  function handleToggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hi-IN';
    utter.rate = 0.9;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex h-10 items-center gap-2 rounded-full border border-[#E8DDD0] bg-white px-4 text-[13px] font-medium text-[#1A1A1A] active:bg-[#FFF0E6]"
    >
      {speaking ? '⏹ Band karo' : '🔊 Suno'}
    </button>
  );
}
