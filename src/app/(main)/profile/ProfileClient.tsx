'use client';

import { useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import PWAInstallButton from '@/components/PWAInstallButton/PWAInstallButton';
import PushNotificationButton from '@/components/PushNotificationButton/PushNotificationButton';
import BackButton from '@/components/BackButton/BackButton';
import type {
  SubscriptionStatus,
  UnitPreference,
  DietType,
  SpiceLevel,
  CookingSkill,
  TimePreference,
} from '@/types/index';

interface ProfileClientProps {
  name: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: string | null;
  dietType: DietType;
  familySize: number;
  preferredUnit: UnitPreference;
  preferredRegion: string | null;
  spicePreference: SpiceLevel;
  cookingSkill: CookingSkill | null;
  timePreference: TimePreference | null;
  kitchenSetup: string[];
}

// ───────── Preference option data (mirrors onboarding) ─────────

type PrefKey =
  | 'diet_type'
  | 'preferred_region'
  | 'spice_preference'
  | 'cooking_skill'
  | 'time_preference'
  | 'kitchen_setup';

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: 'veg', label: '🥬 Pure Veg' },
  { value: 'eggetarian', label: '🍳 Egg bhi chalta hai' },
  { value: 'non-veg', label: '🍗 Non-veg bhi' },
  { value: 'vegan', label: '🌱 Vegan' },
  { value: 'jain', label: '🙏 Jain' },
];

const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'Punjab-Haryana', label: '🌾 Punjab / Haryana' },
  { value: 'UP-Bihar', label: '🏛️ UP / Bihar' },
  { value: 'Delhi-NCR', label: '🌆 Delhi / NCR' },
  { value: 'Rajasthan-MP', label: '🏔️ Rajasthan / MP' },
  { value: 'south-indian', label: '🥥 South Indian' },
  { value: 'bengali', label: '🐟 Bengali' },
  { value: 'gujarati', label: '🥣 Gujarati' },
  { value: 'maharashtrian', label: '🌶️ Maharashtrian' },
  { value: 'any', label: '🗺️ Sab chalega!' },
];

const SPICE_OPTIONS: { value: SpiceLevel; label: string }[] = [
  { value: 'mild', label: '🧊 Bilkul halka' },
  { value: 'medium', label: '🌶 Thoda sa' },
  { value: 'hot', label: '🔥 Achha teekha' },
];

const SKILL_OPTIONS: { value: CookingSkill; label: string }[] = [
  { value: 'beginner', label: '🙂 Naya seekh raha/rahi hoon' },
  { value: 'intermediate', label: '👨‍🍳 Theek-thaak aata hai' },
  { value: 'expert', label: '🔥 Kaafi expert hoon' },
];

const TIME_OPTIONS: { value: TimePreference; label: string }[] = [
  { value: '15min', label: '⚡ 15 minute mein taiyaar' },
  { value: '30min', label: '⏰ 30 minute tak theek hai' },
  { value: 'any', label: '🍲 Time ki koi dikkat nahi' },
];

const KITCHEN_OPTIONS: { value: string; label: string }[] = [
  { value: 'gas-stove', label: '🔥 Gas Stove' },
  { value: 'induction', label: '⚡ Induction' },
  { value: 'microwave', label: '📡 Microwave' },
  { value: 'air-fryer', label: '💨 Air Fryer' },
  { value: 'pressure-cooker', label: '🥘 Pressure Cooker' },
];

const SHEET_TITLES: Record<PrefKey, string> = {
  diet_type: 'Khaane mein kya chalega?',
  preferred_region: 'Kaunse ilaake ka swad pasand hai?',
  spice_preference: 'Teekha kitna pasand hai?',
  cooking_skill: 'Khaana banana kitna aata hai?',
  time_preference: 'Kitna time hota hai usually?',
  kitchen_setup: 'Rasoi mein kya kya hai?',
};

function labelOf(options: { value: string; label: string }[], value: string | null) {
  return options.find((o) => o.value === value)?.label ?? '— Set nahi hai';
}

export default function ProfileClient({
  name,
  subscriptionStatus,
  subscriptionEndsAt,
  dietType,
  familySize,
  preferredUnit: initialUnit,
  preferredRegion: initialRegion,
  spicePreference: initialSpice,
  cookingSkill: initialSkill,
  timePreference: initialTime,
  kitchenSetup: initialKitchen,
}: ProfileClientProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [unit, setUnit] = useState<UnitPreference>(initialUnit);
  const [unitLoading, setUnitLoading] = useState(false);

  // Preferences state
  const [diet, setDiet] = useState<DietType>(dietType);
  const [region, setRegion] = useState<string | null>(initialRegion);
  const [spice, setSpice] = useState<SpiceLevel>(initialSpice);
  const [skill, setSkill] = useState<CookingSkill | null>(initialSkill);
  const [timePref, setTimePref] = useState<TimePreference | null>(initialTime);
  const [kitchen, setKitchen] = useState<string[]>(initialKitchen ?? []);

  const [openSheet, setOpenSheet] = useState<PrefKey | null>(null);
  const [kitchenDraft, setKitchenDraft] = useState<string[]>([]);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState('');

  const isPaid = subscriptionStatus === 'paid';

  const displayName = name ?? 'Aap';

  const endsAtFormatted = subscriptionEndsAt
    ? new Date(subscriptionEndsAt).toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : null;

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

  async function savePref(key: PrefKey, value: string | string[]) {
    if (prefSaving) return;
    setPrefSaving(true);
    setPrefError('');
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error('save failed');
      // Reflect locally
      if (key === 'diet_type') setDiet(value as DietType);
      if (key === 'preferred_region') setRegion(value as string);
      if (key === 'spice_preference') setSpice(value as SpiceLevel);
      if (key === 'cooking_skill') setSkill(value as CookingSkill);
      if (key === 'time_preference') setTimePref(value as TimePreference);
      if (key === 'kitchen_setup') setKitchen(value as string[]);
      setOpenSheet(null);
    } catch {
      setPrefError('Save nahi hua, dobara try karein');
    } finally {
      setPrefSaving(false);
    }
  }

  function openPref(key: PrefKey) {
    setPrefError('');
    if (key === 'kitchen_setup') setKitchenDraft(kitchen);
    setOpenSheet(key);
  }

  function toggleKitchenDraft(value: string) {
    setKitchenDraft((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const kitchenLabel =
    kitchen.length === 0
      ? '— Set nahi hai'
      : kitchen.length === KITCHEN_OPTIONS.length
        ? '✅ Sab kuch hai'
        : KITCHEN_OPTIONS.filter((o) => kitchen.includes(o.value))
          .map((o) => o.label.split(' ')[0])
          .join(' ');

  const prefRows: { key: PrefKey; title: string; value: string }[] = [
    { key: 'diet_type', title: 'Khaana', value: labelOf(DIET_OPTIONS, diet) },
    { key: 'preferred_region', title: 'Ilaaka', value: labelOf(REGION_OPTIONS, region) },
    { key: 'spice_preference', title: 'Teekha', value: labelOf(SPICE_OPTIONS, spice) },
    { key: 'cooking_skill', title: 'Cooking level', value: labelOf(SKILL_OPTIONS, skill) },
    { key: 'time_preference', title: 'Time', value: labelOf(TIME_OPTIONS, timePref) },
    { key: 'kitchen_setup', title: 'Rasoi setup', value: kitchenLabel },
  ];

  // Current single-select value for the open sheet
  const currentValue: string | null =
    openSheet === 'diet_type'
      ? diet
      : openSheet === 'preferred_region'
        ? region
        : openSheet === 'spice_preference'
          ? spice
          : openSheet === 'cooking_skill'
            ? skill
            : openSheet === 'time_preference'
              ? timePref
              : null;

  const sheetOptions: { value: string; label: string }[] =
    openSheet === 'diet_type'
      ? DIET_OPTIONS
      : openSheet === 'preferred_region'
        ? REGION_OPTIONS
        : openSheet === 'spice_preference'
          ? SPICE_OPTIONS
          : openSheet === 'cooking_skill'
            ? SKILL_OPTIONS
            : openSheet === 'time_preference'
              ? TIME_OPTIONS
              : KITCHEN_OPTIONS;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <BackButton fallback="/home" className="bg-[#FFF0E6] text-[#5C3D1E]" />
        <p className="font-bold text-[#1A1A1A]" style={{ fontSize: 16 }}>Mera Profile</p>
      </div>

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

      {/* PWA install */}
      <div className="mt-0">
        <PWAInstallButton />
      </div>

      {/* Push notifications */}
      <PushNotificationButton />

      {/* Meri Preferences */}
      <div className="rounded-2xl border border-[#E8DDD0] bg-white px-4 py-4">
        <p className="mb-1 text-[13px] font-semibold text-[#1A1A1A]">⚙️ Meri Preferences</p>
        <p className="mb-2 text-[11px] text-[#8B7355]">Badalne ke liye tap karein</p>
        <div className="flex flex-col divide-y divide-[#F3EADF]">
          {prefRows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => openPref(row.key)}
              className="flex min-h-[48px] items-center justify-between gap-3 py-2 text-left"
            >
              <p className="flex-shrink-0 text-[13px] text-[#8B7355]">{row.title}</p>
              <p className="flex items-center gap-1 text-right text-[13px] font-medium text-[#1A1A1A]">
                <span className="truncate" style={{ maxWidth: 180 }}>{row.value}</span>
                <span className="text-[#C4A584]">›</span>
              </p>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[#F3EADF] pt-3">
          <p className="text-[13px] text-[#8B7355]">Parivar</p>
          <p className="text-[13px] font-medium text-[#1A1A1A]">{familySize} log</p>
        </div>
      </div>

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
              className={`min-h-[40px] rounded-full px-4 text-[12px] font-semibold transition-colors ${unit === 'desi'
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
              className={`min-h-[40px] rounded-full px-4 text-[12px] font-semibold transition-colors ${unit === 'metric'
                  ? 'bg-[#E8640C] text-white'
                  : 'text-[#8B7355]'
                }`}
            >
              Metric
            </button>
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

      {/* Preference bottom-sheet */}
      {openSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Band karein"
            onClick={() => !prefSaving && setOpenSheet(null)}
            className="absolute inset-0 bg-black/40"
          />
          {/* Sheet */}
          <div
            className="slide-up relative w-full max-w-md rounded-t-3xl bg-white px-5 pb-8 pt-3"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E8D5C0]" />
            <p className="font-display mb-4 text-[18px]" style={{ color: 'var(--terracotta)' }}>
              {SHEET_TITLES[openSheet]}
            </p>

            {prefError && (
              <p
                className="mb-3 rounded-lg px-4 py-3"
                style={{ fontSize: 13, background: '#FDEAEA', color: '#B42318' }}
              >
                {prefError}
              </p>
            )}

            {openSheet === 'kitchen_setup' ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {KITCHEN_OPTIONS.map((opt) => {
                    const selected = kitchenDraft.includes(opt.value);
                    return (
                      <SheetOption
                        key={opt.value}
                        selected={selected}
                        onClick={() => toggleKitchenDraft(opt.value)}
                        label={opt.label}
                      />
                    );
                  })}
                  <SheetOption
                    selected={kitchenDraft.length === KITCHEN_OPTIONS.length}
                    onClick={() => setKitchenDraft(KITCHEN_OPTIONS.map((o) => o.value))}
                    label="✅ Sab kuch hai!"
                  />
                </div>
                <button
                  type="button"
                  disabled={kitchenDraft.length === 0 || prefSaving}
                  onClick={() => savePref('kitchen_setup', kitchenDraft)}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#E8640C] text-[15px] font-bold text-white active:opacity-90 disabled:opacity-40"
                >
                  {prefSaving ? 'Thoda ruko…' : 'Save karein ✓'}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sheetOptions.map((opt) => (
                  <SheetOption
                    key={opt.value}
                    selected={currentValue === opt.value}
                    onClick={() => savePref(openSheet, opt.value)}
                    label={opt.label}
                    disabled={prefSaving}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SheetOption({
  selected,
  onClick,
  label,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`tap-spring flex min-h-[52px] items-center justify-between rounded-2xl border-2 px-4 text-left text-[14px] font-medium transition-all ${selected
          ? 'border-[#E8640C] bg-[#FFF0E6] text-[#1A1A1A]'
          : 'border-[#E8D5C0] bg-white text-[#1A1A1A]'
        } disabled:opacity-50`}
    >
      <span>{label}</span>
      {selected && <span className="text-[#E8640C]">✓</span>}
    </button>
  );
}
