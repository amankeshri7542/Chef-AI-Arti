'use client';

import { useState } from 'react';
import { shouldShowScalingWarning } from '@/lib/portion';
import AnimatedNumber from '@/components/AnimatedNumber/AnimatedNumber';
import { haptic } from '@/lib/haptics';
import type { SubscriptionStatus } from '@/types/index';

interface PortionSelectorProps {
  baseSize: number;
  currentSize: number;
  onChange: (size: number) => void;
  subscriptionStatus: SubscriptionStatus;
  onUpgradeClick?: () => void;
}

const FREE_MAX = 6;
const PAID_MAX = 15;
const MIN = 1;
const COLS = 5;

export default function PortionSelector({
  baseSize,
  currentSize,
  onChange,
  subscriptionStatus,
  onUpgradeClick,
}: PortionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isPaid = subscriptionStatus === 'paid';
  const showWarning = shouldShowScalingWarning(baseSize, currentSize);

  function handleSeatTap(n: number) {
    if (n < MIN) return;
    if (!isPaid && n > FREE_MAX) {
      haptic('warning');
      onUpgradeClick?.();
      return;
    }
    haptic('tap');
    onChange(n);
  }

  function handleConfirm() {
    setIsOpen(false);
  }

  const seats = Array.from({ length: PAID_MAX }, (_, i) => i + 1);

  return (
    <>
      {/* Closed state — pill trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors active:scale-95"
        style={{
          height: 44,
          background: '#FFFFFF',
          border: '1.5px solid #E8640C',
          color: '#E8640C',
        }}
      >
        <span className="text-[16px]">👨‍👩‍👧</span>
        <span><AnimatedNumber value={currentSize} /> log ke liye</span>
        <span className="text-[10px] ml-1">▼</span>
      </button>

      {showWarning && (
        <p className="mt-1 text-[11px] text-[#8B7355]">
          ⚠️ Namak thoda thoda milao — ek baar mein mat daal dena.
        </p>
      )}

      {/* Bottom sheet overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          <div className="animate-sheet-spring relative w-full max-w-md rounded-t-2xl bg-white px-5 pb-6 pt-5">
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E8DDD0]" />

            <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-4">
              Kitne logon ke liye pakana hai?
            </h3>

            {/* Seat grid — 5 cols × 3 rows */}
            <div
              className="grid justify-center mx-auto mb-4"
              style={{
                gridTemplateColumns: `repeat(${COLS}, 44px)`,
                gap: 12,
                maxWidth: COLS * 44 + (COLS - 1) * 12,
              }}
            >
              {seats.map((n) => {
                const isSelected = n <= currentSize;
                const isLocked = !isPaid && n > FREE_MAX;

                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSeatTap(n)}
                    className="flex items-center justify-center rounded-full transition-all active:scale-90"
                    style={{
                      width: 44,
                      height: 44,
                      background: isLocked
                        ? '#E8DDD0'
                        : isSelected
                          ? '#E8640C'
                          : '#FFFFFF',
                      border: isLocked
                        ? 'none'
                        : isSelected
                          ? '2px solid #E8640C'
                          : '2px solid #E8640C',
                      color: isLocked
                        ? '#8B7355'
                        : isSelected
                          ? '#FFFFFF'
                          : '#E8640C',
                      fontSize: isLocked ? 14 : 15,
                      fontWeight: 700,
                    }}
                    aria-label={isLocked ? `${n} — Premium mein milega` : `${n} log`}
                  >
                    {isLocked ? '🔒' : n}
                  </button>
                );
              })}
            </div>

            {/* Live label */}
            <p className="text-center text-[12px] text-[#8B7355] mb-4">
              <AnimatedNumber value={currentSize} className="font-semibold text-[#E8640C]" /> logon ke liye ingredients calculate ho rahe hain
            </p>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleConfirm}
              className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold text-white active:opacity-90"
              style={{ background: '#E8640C' }}
            >
              ✓ Theek hai
            </button>

            {!isPaid && (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="mt-2 w-full text-center text-[11px] font-medium text-[#E8640C]"
                style={{ minHeight: 40 }}
              >
                15 logon tak ke liye Premium lo! ₹150/mahine →
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
