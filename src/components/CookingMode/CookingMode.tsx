'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Recipe, Ingredient, UnitPreference } from '@/types/index';
import { scaleIngredients } from '@/lib/portion';
import { StarRatingInteractive } from '@/components/StarRating/StarRating';
import { haptic } from '@/lib/haptics';

interface CookingModeProps {
  recipe: Recipe;
  portionSize: number;
  unitPreference?: UnitPreference;
  onExit: () => void;
}

export default function CookingMode({ recipe, portionSize, unitPreference = 'desi', onExit }: CookingModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [cookedMarked, setCookedMarked] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = recipe.steps;
  const totalSteps = steps.length;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // TTS — speak step instruction
  const speak = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hi-IN';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }, [isMuted]);

  // Auto-read step on change
  useEffect(() => {
    if (!showCompletion && step) {
      speak(step.instruction);
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentStep, showCompletion, step, speak]);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            // Vibrate on timer complete
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerSeconds]);

  function goNext() {
    if (currentStep < totalSteps - 1) {
      haptic('tap');
      setCurrentStep(currentStep + 1);
      resetTimer();
    } else {
      haptic('success');
      setShowCompletion(true);
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      haptic('tap');
      setCurrentStep(currentStep - 1);
      resetTimer();
    }
  }

  function resetTimer() {
    setTimerActive(false);
    setTimerSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function startTimer(minutes: number) {
    resetTimer();
    setTimerSeconds(minutes * 60);
    setTimerActive(true);
  }

  function formatTimer(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Swipe gesture handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext(); // swipe left → next
      else goPrev(); // swipe right → prev
    }
  }

  async function handleCooked() {
    if (cookedMarked) return;
    setCookedMarked(true);
    try {
      await fetch(`/api/recipes/${recipe.id}/cooked`, { method: 'POST' });
    } catch {
      // silent
    }
  }

  async function handleRating(rating: number) {
    if (ratingLoading) return;
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) setUserRating(rating);
    } catch {
      // silent
    } finally {
      setRatingLoading(false);
    }
  }

  // Auto font size for long instructions
  const instructionFontSize = step && step.instruction.length > 60 ? 18 : 22;

  if (showCompletion) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--cream, #FFF8F0)' }}>
        <div className="text-center animate-fade-in-up">
          <p className="text-5xl mb-4">🎉 ✨ 🍳</p>
          <h2 className="font-display text-[24px] font-bold text-[#1A1A1A] mb-2"
            style={{ fontFamily: 'var(--font-playfair, Playfair Display, serif)' }}>
            Khaana taiyaar hai! 🍳
          </h2>
          <p className="text-[13px] text-[#8B7355] mb-6">{recipe.name_hinglish}</p>

          {/* Rating */}
          <div className="mb-6">
            <p className="text-[12px] font-medium text-[#E8640C] mb-3">
              Kitna acha bana? Rating do! ⭐
            </p>
            <StarRatingInteractive
              value={userRating}
              onChange={handleRating}
              size="lg"
              disabled={ratingLoading}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
            <button
              type="button"
              onClick={handleCooked}
              disabled={cookedMarked}
              className="flex h-14 items-center justify-center rounded-2xl text-[16px] font-bold text-white"
              style={{ background: cookedMarked ? '#22C55E' : '#E8640C' }}
            >
              {cookedMarked ? '✅ Bana liya! Shukriya!' : '✅ Bana liya!'}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex h-12 items-center justify-center rounded-xl text-[14px] font-medium"
              style={{ color: '#8B7355', border: '1px solid #E8DDD0', background: '#FFFFFF' }}
            >
              🏠 Ghar chalein
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--cream, #FFF8F0)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-[#E8DDD0]">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, background: '#E8640C' }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 text-[13px] font-medium text-[#8B7355]"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          ✕ Bahar
        </button>
        <p className="flex-1 text-center text-[12px] text-[#8B7355] truncate px-2">
          {recipe.name_hinglish}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              if (!isMuted) window.speechSynthesis?.cancel();
            }}
            className="flex items-center justify-center text-[18px]"
            style={{ minHeight: 44, minWidth: 44 }}
            aria-label={isMuted ? 'Awaaz chalu karo' : 'Awaaz band karo'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <span className="text-[13px] text-[#8B7355] font-medium">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Step number circle */}
        <div
          className="flex items-center justify-center rounded-full mb-6"
          style={{
            width: 64,
            height: 64,
            background: '#E8640C',
          }}
        >
          <span
            className="text-white font-bold"
            style={{
              fontSize: 32,
              fontFamily: 'var(--font-playfair, Playfair Display, serif)',
            }}
          >
            {step.step}
          </span>
        </div>

        {/* Step instruction — BIG TEXT readable from 50cm */}
        <p
          className="text-center font-medium leading-relaxed text-[#2C1810] mb-6"
          style={{
            fontSize: instructionFontSize,
            lineHeight: 1.6,
            maxWidth: 360,
          }}
          onClick={() => speak(step.instruction)}
        >
          {step.instruction}
        </p>

        {/* Step timer */}
        {step.time_minutes > 0 && (
          <div className="flex flex-col items-center gap-2">
            {!timerActive && timerSeconds === 0 ? (
              <button
                type="button"
                onClick={() => startTimer(step.time_minutes)}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium"
                style={{ background: '#FFF0E6', color: '#E8640C', border: '1px solid #E8DDD0' }}
              >
                ⏱ {step.time_minutes} minute — Timer lagao
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span
                  className="font-bold"
                  style={{
                    fontSize: 28,
                    color: timerSeconds === 0 ? '#22C55E' : '#E8640C',
                  }}
                >
                  {timerSeconds === 0 ? '✅ Ho gaya!' : formatTimer(timerSeconds)}
                </span>
                <span className="text-[11px] text-[#8B7355]">
                  {timerSeconds > 0 ? 'baaki hai' : ''}
                </span>
                {timerActive && (
                  <button
                    type="button"
                    onClick={resetTimer}
                    className="text-[11px] text-[#8B7355] underline"
                    style={{ minHeight: 32 }}
                  >
                    Timer band karo
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex gap-3 px-4 pb-6 pt-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="flex h-[52px] flex-1 items-center justify-center rounded-xl text-[15px] font-semibold transition-opacity disabled:opacity-30"
          style={{ background: '#FFFFFF', border: '2px solid #E8640C', color: '#E8640C' }}
        >
          ← Pichla
        </button>
        <button
          type="button"
          onClick={goNext}
          className="flex h-[52px] flex-1 items-center justify-center rounded-xl text-[15px] font-bold text-white"
          style={{ background: '#E8640C' }}
        >
          {currentStep === totalSteps - 1 ? 'Ho Gaya! 🎉' : 'Agla →'}
        </button>
      </div>
    </div>
  );
}
