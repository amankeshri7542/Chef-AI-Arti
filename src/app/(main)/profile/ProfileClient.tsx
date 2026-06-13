'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import PWAInstallButton from '@/components/PWAInstallButton/PWAInstallButton';
import PushNotificationButton from '@/components/PushNotificationButton/PushNotificationButton';
import BackButton from '@/components/BackButton/BackButton';
import { IOSInstallProfileSection } from '@/components/IOSInstallPrompt/IOSInstallPrompt';
import Icon, { type IconName } from '@/components/editorial/Icon';
import DishImage from '@/components/editorial/DishArt';
import { GridCard } from '@/components/editorial/RecipeCards';
import { SectionHead } from '@/components/editorial/SectionHead';
import type {
  Recipe,
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
  savedRecipes: Recipe[];
  generatedRecipes: { id: string; name: string; youtubeVideoId: string | null }[];
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

const PREF_ICON: Record<PrefKey, IconName> = {
  diet_type: 'leaf',
  preferred_region: 'map',
  spice_preference: 'chili',
  cooking_skill: 'pan',
  time_preference: 'clock',
  kitchen_setup: 'flame',
};

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
  savedRecipes,
  generatedRecipes,
}: ProfileClientProps) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [unit, setUnit] = useState<UnitPreference>(initialUnit);
  const [unitLoading, setUnitLoading] = useState(false);

  // Household size — editable stepper (was a fixed display before).
  const [people, setPeople] = useState(familySize);
  const [peopleSaving, setPeopleSaving] = useState(false);

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

  async function changePeople(delta: number) {
    const next = Math.min(15, Math.max(1, people + delta));
    if (next === people || peopleSaving) return;
    setPeople(next);
    setPeopleSaving(true);
    try {
      await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_size: next }),
      });
    } catch {
      setPeople(people); // revert on failure
    } finally {
      setPeopleSaving(false);
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
    <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
      {/* Editorial header */}
      <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
          <div>
            <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Aapka profile</div>
            <h1 className="t-display" style={{ fontSize: 22, margin: 0, color: 'var(--text)' }}>Mera Rasoi Ghar</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-col" style={{ gap: 16, padding: '16px 18px 96px' }}>
        {/* Identity card */}
        <div className="r-card card-entry stg-1" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>👩‍🍳</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-display" style={{ fontSize: 20, color: 'var(--text)' }}>{displayName}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '3px 10px', borderRadius: 99, background: isPaid ? 'var(--green-lt)' : 'var(--hero-lt)', fontSize: 12, fontWeight: 600, color: isPaid ? 'var(--green)' : 'var(--hero-dk)' }}>
              {isPaid ? <><Icon name="sparkle" size={13} color="var(--green)" /> Premium Member</> : <><Icon name="leaf" size={13} color="var(--hero-dk)" /> Free Member</>}
            </span>
          </div>
        </div>

        {/* Subscription card */}
        {isPaid ? (
          <div className="r-card card-entry stg-2" style={{ padding: '18px 20px', background: 'var(--green-lt)', borderColor: 'var(--green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name="sparkle" size={20} color="var(--green)" />
              <span className="t-display" style={{ fontSize: 19, color: 'var(--green)' }}>Premium chal raha hai</span>
            </div>
            {endsAtFormatted && <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--green)' }}>Active till {endsAtFormatted}</p>}
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)' }}>Unlimited chat, fridge scan, aur WhatsApp share — sab enjoy karein! 🎉</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="r-card card-entry stg-2 tap-spring tadka-host"
            style={{ display: 'block', width: '100%', padding: '18px 20px', textAlign: 'left', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--hero) 0%, var(--hero-dk) 100%)', border: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#fff' }}>
              <Icon name="sparkle" size={20} color="#fff" />
              <span className="t-display" style={{ fontSize: 20, color: '#fff' }}>Premium lein</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'rgba(255,255,255,0.92)' }}>Unlimited Arti, fridge scan aur share — sirf ₹150/mahina, chai ke ek cup se kam ☕</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 99, background: '#fff', color: 'var(--hero-dk)', fontWeight: 700, fontSize: 14 }}>
              Premium banein <Icon name="chevR" size={16} color="var(--hero-dk)" />
            </span>
          </button>
        )}

        {/* Saved recipes */}
        {savedRecipes.length > 0 && (
          <section>
            <SectionHead over="Dil se save kiye" title="Saved Recipes" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              {savedRecipes.map((recipe, i) => (
                <GridCard key={recipe.id} recipe={recipe} idx={i % 6} saved onOpen={(id) => router.push('/recipe/' + id)} />
              ))}
            </div>
          </section>
        )}

        {/* Recipes Arti generated — only entry point back to pending recipes */}
        {generatedRecipes.length > 0 && (
          <section>
            <SectionHead over="Sirf aapke liye" title="Arti ne aapke liye banayi" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {generatedRecipes.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => router.push('/recipe/pending/' + g.id)}
                  className="r-card tap-spring"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, width: '100%', textAlign: 'left' }}
                >
                  {g.youtubeVideoId ? (
                    <DishImage recipe={{ id: g.id, thumbnail_url: `https://img.youtube.com/vi/${g.youtubeVideoId}/default.jpg`, name_hinglish: g.name }} sizes="56px" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }} />
                  ) : (
                    <DishImage recipe={{ id: g.id, name_hinglish: g.name }} sizes="56px" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="t-display" style={{ display: 'block', fontSize: 16, color: 'var(--text)' }}>{g.name}</span>
                    <span className="t-caption" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="sparkle" size={12} color="var(--hero-dk)" /> Aapke liye generate ki</span>
                  </span>
                  <Icon name="chevR" size={18} color="var(--muted)" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Preferences */}
        <section>
          <SectionHead over="Sab badal sakti hain" title="Meri Preferences" />
          <div className="r-card" style={{ marginTop: 12, overflow: 'hidden' }}>
            {prefRows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                onClick={() => openPref(row.key)}
                className="tap-spring"
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', borderBottom: i < prefRows.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 56, textAlign: 'left' }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={PREF_ICON[row.key]} size={18} color="var(--hero-dk)" />
                </span>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: 'var(--text)' }}>{row.title}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                <Icon name="chevR" size={16} color="var(--muted)" />
              </button>
            ))}
            {/* Parivar stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text)' }}>Parivar</p>
                <p className="t-caption">Kitne log khaate hain?</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" aria-label="Kam karein" disabled={peopleSaving || people <= 1} onClick={() => changePeople(-1)} className="tap-spring" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--hero-lt)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: people <= 1 ? 0.4 : 1 }}>
                  <Icon name="minus" size={20} color="var(--hero-dk)" sw={2.2} />
                </button>
                <span className="t-display" style={{ minWidth: 56, textAlign: 'center', fontSize: 18, color: 'var(--text)' }}>{people} log</span>
                <button type="button" aria-label="Zyada karein" disabled={peopleSaving || people >= 15} onClick={() => changePeople(1)} className="tap-spring" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--hero-lt)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: people >= 15 ? 0.4 : 1 }}>
                  <Icon name="plus" size={20} color="var(--hero-dk)" sw={2.2} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Settings: units */}
        <div className="r-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="wheat" size={18} color="var(--hero-dk)" /></span>
            <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text)' }}>Naap-tol</span>
          </span>
          <div style={{ display: 'flex', background: 'var(--hero-lt)', borderRadius: 99, padding: 3 }}>
            {(['desi', 'metric'] as const).map((u) => (
              <button key={u} type="button" disabled={unitLoading} onClick={() => toggleUnit(u)} className="tap-spring" style={{ minHeight: 42, padding: '0 18px', borderRadius: 99, fontSize: 13.5, fontWeight: 600, color: unit === u ? '#fff' : 'var(--muted)', background: unit === u ? 'var(--hero)' : 'transparent', transition: 'all 0.2s', textTransform: 'capitalize' }}>{u === 'desi' ? 'Desi' : 'Metric'}</button>
            ))}
          </div>
        </div>

        {/* PWA install (Android) + iOS install instructions */}
        <div className="flex flex-col gap-2">
          <PWAInstallButton />
          <IOSInstallProfileSection />
        </div>

        {/* Push notifications */}
        <PushNotificationButton />

        {/* Sign out */}
        <div className="r-card" style={{ padding: '4px 16px' }}>
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className="flex h-12 w-full items-center justify-center gap-2 text-[14px] font-medium" style={{ color: '#C0392B' }}>
              🚪 Sign out karein
            </button>
          </SignOutButton>
        </div>
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
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full" style={{ background: 'var(--border)' }} />
            <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Badal lein</div>
            <p className="t-display mb-4" style={{ fontSize: 21, color: 'var(--text)', marginTop: 4 }}>
              {SHEET_TITLES[openSheet]}
            </p>

            {prefError && (
              <p
                className="mb-3 rounded-lg px-4 py-3"
                style={{ fontSize: 13, background: '#FFF0E6', border: '1px solid #F5A55B', color: '#BF4E06' }}
              >
                ⚠️ {prefError}
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
                  className="r-cta tap-spring mt-4 disabled:opacity-40"
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
      className="tap-spring flex min-h-[56px] items-center justify-between rounded-2xl px-4 text-left text-[15px] disabled:opacity-50"
      style={{
        border: selected ? '1.5px solid var(--hero)' : '1.5px solid var(--border)',
        background: selected ? 'var(--hero-lt)' : 'var(--card)',
        color: 'var(--text)',
        fontWeight: selected ? 600 : 400,
      }}
    >
      <span>{label}</span>
      {selected && (
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--hero)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={15} color="#fff" sw={2.6} />
        </span>
      )}
    </button>
  );
}
