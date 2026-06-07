'use client';

import { shouldShowScalingWarning } from '@/lib/portion';
import type { SubscriptionStatus } from '@/types/index';

interface PortionSliderProps {
  baseSize: number;
  currentSize: number;
  onChange: (size: number) => void;
  subscriptionStatus: SubscriptionStatus;
  onUpgradeClick?: () => void;
}

const FREE_MAX = 6;
const PAID_MAX = 15;
const MIN = 2;

export default function PortionSlider({
  baseSize,
  currentSize,
  onChange,
  subscriptionStatus,
  onUpgradeClick,
}: PortionSliderProps) {
  const isPaid = subscriptionStatus === 'paid';
  const max = isPaid ? PAID_MAX : FREE_MAX;
  const showWarning = shouldShowScalingWarning(baseSize, currentSize);
  const atFreeLimit = !isPaid && currentSize >= FREE_MAX;

  function clampedChange(val: number) {
    onChange(Math.min(max, Math.max(MIN, val)));
  }

  return (
    <div className="rounded-xl border border-[#E8DDD0] bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#1A1A1A]">Kitne logo ke liye? 👨‍👩‍👧‍👦</p>
        <span
          className="min-w-[32px] rounded-full px-2 py-0.5 text-center text-[13px] font-bold text-white"
          style={{ background: '#E8640C' }}
        >
          {currentSize}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => clampedChange(currentSize - 1)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#E8DDD0] text-[18px] font-bold text-[#1A1A1A] active:bg-[#FFF0E6]"
          aria-label="Kam karo"
        >
          −
        </button>
        <input
          type="range"
          min={MIN}
          max={max}
          value={currentSize}
          onChange={(e) => clampedChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-[#E8640C]"
        />
        <button
          type="button"
          onClick={() => clampedChange(currentSize + 1)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#E8DDD0] text-[18px] font-bold text-[#1A1A1A] active:bg-[#FFF0E6]"
          aria-label="Badhao"
        >
          +
        </button>
      </div>

      {showWarning && (
        <p className="mt-2 text-[11px] text-[#8B7355]">
          ⚠️ Namak thoda thoda milao — ek baar mein mat daal dena.
        </p>
      )}

      {atFreeLimit && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="mt-2 min-h-[48px] w-full rounded-lg px-2 py-1 text-left text-[11px] font-medium text-[#E8640C] active:bg-[#FFF0E6]"
        >
          15 logon tak ke liye Premium lo! ₹150/mahine →
        </button>
      )}
    </div>
  );
}
