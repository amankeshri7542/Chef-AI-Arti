'use client';

import { useState, useEffect } from 'react';
import { speakText, stopSpeaking, isTTSSupported } from '@/lib/tts';

interface TTSButtonProps {
  text: string;
}

export default function TTSButton({ text }: TTSButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  // Render the button on both server and client (avoids hydration mismatch);
  // hide it after mount only if the browser truly lacks speechSynthesis.
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isTTSSupported());
  }, []);

  if (!supported) return null;

  function handleToggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speakText(text, {
      onend: () => setSpeaking(false),
      onerror: () => setSpeaking(false),
    });
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
