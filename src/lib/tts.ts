// Web Speech helper with Hindi voice fallback.
// hi-IN is not installed on many budget Android phones — fall back to en-IN,
// then the device default (at least it reads something).

let voicesLoaded = false;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.startsWith('hi')) ??
    voices.find((v) => v.lang.startsWith('en-IN')) ??
    null
  );
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  onend?: () => void;
  onerror?: () => void;
}

export function speakText(text: string, opts: SpeakOptions = {}): void {
  if (!isTTSSupported()) return;

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'hi-IN';
    }
    utterance.rate = 0.85; // slightly slower for older users
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (opts.onend) utterance.onend = opts.onend;
    if (opts.onerror) utterance.onerror = opts.onerror;

    window.speechSynthesis.cancel(); // stop any current speech
    window.speechSynthesis.speak(utterance);
  };

  // Voices load async on some browsers — wait for them on the first call
  if (!voicesLoaded && window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      voicesLoaded = true;
      window.speechSynthesis.onvoiceschanged = null;
      speak();
    };
    // Some Androids never fire onvoiceschanged — speak anyway after a beat
    setTimeout(() => {
      if (!voicesLoaded) {
        voicesLoaded = true;
        window.speechSynthesis.onvoiceschanged = null;
        speak();
      }
    }, 250);
    return;
  }

  voicesLoaded = true;
  speak();
}

export function stopSpeaking(): void {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
}
