'use client';

import { useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import type { SubscriptionStatus, UnitPreference, DietType } from '@/types/index';

interface ProfileClientProps {
  name: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: string | null;
  dietType: DietType;
  familySize: number;
  preferredUnit: UnitPreference;
}

export default function ProfileClient({
  name,
  subscriptionStatus,
  subscriptionEndsAt,
  dietType,
  familySize,
  preferredUnit: initialUnit,
}: ProfileClientProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [unit, setUnit] = useState<UnitPreference>(initialUnit);
  const [unitLoading, setUnitLoading] = useState(false);

  const isPaid = subscriptionStatus === 'paid';

  const displayName = name ?? 'Aap';

  const endsAtFormatted = subscriptionEndsAt
    ? new Date(subscriptionEndsAt).toLocaleDateString('hi-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const dietLabels: Record<DietType, string> = {
    veg: '🥬 Vegetarian',
    'non-veg': '🍗 Non-Veg',
    eggetarian: '🥚 Eggetarian',
  };

  async function toggleUnit(newUnit: UnitPreference) {
    if (newUnit === unit || unitLoading) return;
    setUnitLoading(true);
    try {
      await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_unit: newUnit }),
      });
      setUnit(newUnit);
    } catch {
      // Silent fail — unit stays the same
    } finally {
      setUnitLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ background: 'linear-gradient(135deg, #FDDBC2, #FBC08A)' }}
        >
          👩‍🍳
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-[#1A1A1A] truncate">{displayName}</p>
          {isPaid ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
              💎 Premium
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-[#E8640C]">
              🆓 Free Plan
            </span>
          )}
        </div>
      </div>

      {/* Subscription card */}
      {isPaid ? (
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 px-4 py-4">
          <p className="text-[15px] font-bold text-green-800">💎 Premium Member</p>
          {endsAtFormatted && (
            <p className="mt-1 text-[12px] text-green-700">Active till {endsAtFormatted}</p>
          )}
          <p className="mt-2 text-[12px] text-green-600">
            Unlimited chat, fridge scan, aur WhatsApp share — sab enjoy karein! 🎉
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-[#E8640C] bg-[#FFF0E6] px-4 py-4">
          <p className="text-[15px] font-bold text-[#1A1A1A]">🆓 Free Plan</p>
          <p className="mt-1 text-[12px] text-[#8B7355]">
            Sirf 3 chat messages/din. Unlimited ke liye upgrade karein!
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#E8640C]">₹150/mahine mein sab kuch pao</p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#E8640C] text-[15px] font-bold text-white active:opacity-90"
          >
            Premium lo 🚀
          </button>
        </div>
      )}

      {/* Settings */}
      <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4">
        <p className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">⚙️ Settings</p>

        {/* Units toggle */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#1A1A1A]">📏 Units</p>
          <div className="flex items-center gap-1 rounded-full border border-[#E8DDD0] bg-[#FFF0E6] p-1">
            <button
              type="button"
              disabled={unitLoading}
              onClick={() => toggleUnit('desi')}
              className={`min-h-[40px] rounded-full px-4 text-[12px] font-semibold transition-colors ${
                unit === 'desi'
                  ? 'bg-[#E8640C] text-white'
                  : 'text-[#8B7355]'
              }`}
            >
              Desi
            </button>
            <button
              type="button"
              disabled={unitLoading}
              onClick={() => toggleUnit('metric')}
              className={`min-h-[40px] rounded-full px-4 text-[12px] font-semibold transition-colors ${
                unit === 'metric'
                  ? 'bg-[#E8640C] text-white'
                  : 'text-[#8B7355]'
              }`}
            >
              Metric
            </button>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4">
        <p className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">👤 Aapki Details</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8B7355]">Khaana</p>
            <p className="text-[13px] font-medium text-[#1A1A1A]">{dietLabels[dietType]}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8B7355]">Parivar</p>
            <p className="text-[13px] font-medium text-[#1A1A1A]">{familySize} log</p>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-2">
        <SignOutButton redirectUrl="/sign-in">
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 text-[14px] font-medium text-red-500"
          >
            🚪 Sign out karein
          </button>
        </SignOutButton>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
