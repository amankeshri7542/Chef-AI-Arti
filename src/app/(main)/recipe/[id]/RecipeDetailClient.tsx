'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, Ingredient, UnitPreference, SubscriptionStatus, VibeBadgeKey } from '@/types/index';
import { scaleIngredients } from '@/lib/portion';
import PortionSlider from '@/components/PortionSlider/PortionSlider';
import TTSButton from '@/components/TTSButton/TTSButton';
import VibeBadges from '@/components/VibeBadges/VibeBadges';
import WhatsAppShare from '@/components/WhatsAppShare/WhatsAppShare';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';

interface RecipeDetailClientProps {
  recipe: Recipe;
  familySize: number;
  unitPreference: UnitPreference;
  subscriptionStatus: SubscriptionStatus;
}

function ttsText(recipe: Recipe, scaledIngredients: Ingredient[], portionSize: number): string {
  const lines = [
    `${recipe.name_hinglish} — ${portionSize} logo ke liye.`,
    'Samagri:',
    ...scaledIngredients.map((i) => `${i.name}: ${i.qty_desi}`),
    'Banane ka tarika:',
    ...recipe.steps.map((s) => s.instruction),
  ];
  return lines.join('. ');
}

export default function RecipeDetailClient({
  recipe,
  familySize,
  unitPreference,
  subscriptionStatus,
}: RecipeDetailClientProps) {
  const router = useRouter();
  const [portionSize, setPortionSize] = useState(familySize);
  const [cookedLoading, setCookedLoading] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const scaledIngredients = scaleIngredients(recipe.ingredients, recipe.base_family_size, portionSize);
  const isPaid = subscriptionStatus === 'paid';

  async function handleCooked() {
    if (cooked || cookedLoading) return;
    setCookedLoading(true);
    await fetch(`/api/recipes/${recipe.id}/cooked`, { method: 'POST' });
    setCookedLoading(false);
    setCooked(true);
  }

  const totalMinutes = recipe.prep_time_minutes + recipe.cook_time_minutes;

  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#E8DDD0] bg-white px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E8DDD0] text-lg"
          aria-label="Wapas jao"
        >
          ←
        </button>
        <h1 className="line-clamp-1 flex-1 text-[15px] font-semibold text-[#1A1A1A]">
          {recipe.name_hinglish}
        </h1>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Hero thumbnail */}
        <div
          className="flex h-48 w-full items-center justify-center rounded-2xl text-6xl"
          style={{
            background: 'linear-gradient(135deg, #FDDBC2, #FBC08A)',
          }}
        >
          {recipe.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.thumbnail_url}
              alt={recipe.name_hinglish}
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            getCategoryEmoji(recipe.category)
          )}
        </div>

        {/* Name + meta */}
        <div>
          <h2 className="text-[20px] font-bold text-[#1A1A1A]">{recipe.name_hinglish}</h2>
          {recipe.name_hindi && (
            <p className="mt-0.5 text-[13px] text-[#8B7355]" style={{ fontFamily: 'var(--font-devanagari)' }}>
              {recipe.name_hindi}
            </p>
          )}
          {recipe.description && (
            <p className="mt-2 text-[13px] text-[#8B7355]">{recipe.description}</p>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-2">
          <StatChip emoji="⏱" label={`${recipe.cook_time_minutes} min cooking`} />
          {recipe.prep_time_minutes > 0 && (
            <StatChip emoji="🔪" label={`${recipe.prep_time_minutes} min prep`} />
          )}
          {recipe.soak_required && <StatChip emoji="💧" label="Raat bhar bhigao" />}
          <StatChip emoji="🌶" label={recipe.spice_level} />
          <StatChip emoji="⚖️" label={recipe.heaviness} />
        </div>

        {/* Vibes */}
        {recipe.vibes.length > 0 && (
          <VibeBadges vibes={recipe.vibes as VibeBadgeKey[]} />
        )}

        {/* Portion slider */}
        <PortionSlider
          baseSize={recipe.base_family_size}
          currentSize={portionSize}
          onChange={setPortionSize}
          subscriptionStatus={subscriptionStatus}
          onUpgradeClick={() => setUpgradeOpen(true)}
        />

        {/* Ingredients */}
        <section>
          <h3 className="mb-2 text-[15px] font-semibold text-[#1A1A1A]">Samagri 🛒</h3>
          <div className="rounded-xl border border-[#E8DDD0] bg-white divide-y divide-[#E8DDD0]">
            {scaledIngredients.map((ing, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[#1A1A1A]">{ing.name}</p>
                  {ing.prep && <p className="text-[11px] text-[#8B7355]">{ing.prep}</p>}
                </div>
                <p className="text-[13px] text-[#E8640C] font-semibold">
                  {unitPreference === 'metric' ? ing.qty_metric : ing.qty_desi}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Goes well with */}
        {recipe.goes_well_with.length > 0 && (
          <p className="text-[12px] text-[#8B7355]">
            🍽 Ke saath: {recipe.goes_well_with.join(', ')}
          </p>
        )}

        {/* TTS button row */}
        <div className="flex flex-wrap gap-2">
          <TTSButton
            text={ttsText(recipe, scaledIngredients, portionSize)}
          />
          <WhatsAppShare
            recipeName={recipe.name_hinglish}
            recipeId={recipe.id}
            isPaid={isPaid}
            onUpgradeClick={() => setUpgradeOpen(true)}
          />
        </div>

        {/* Steps */}
        <section>
          <h3 className="mb-3 text-[15px] font-semibold text-[#1A1A1A]">Banane ka tarika 👩‍🍳</h3>
          <div className="flex flex-col gap-3">
            {recipe.steps.map((step) => (
              <div key={step.step} className="flex gap-3">
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: '#E8640C' }}
                >
                  {step.step}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[13px] text-[#1A1A1A]">{step.instruction}</p>
                  {step.time_minutes > 0 && (
                    <p className="mt-1 text-[11px] text-[#8B7355]">⏱ ~{step.time_minutes} min</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* Bana liya button */}
        <button
          type="button"
          onClick={handleCooked}
          disabled={cooked || cookedLoading}
          className="flex h-14 w-full items-center justify-center rounded-2xl text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
          style={{ background: cooked ? '#22C55E' : '#E8640C' }}
        >
          {cookedLoading ? 'Saving...' : cooked ? '✅ Bana liya! Shukriya!' : '✅ Bana liya!'}
        </button>
      </div>

      {/* Floating chat button */}
      <FloatingChatButton recipeId={recipe.id} recipeName={recipe.name_hinglish} />

      {/* Upgrade modal */}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

function StatChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#E8DDD0] bg-white px-3 py-1 text-[11px] text-[#8B7355]">
      {emoji} {label}
    </span>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    sabzi: '🥬', dal: '🫘', roti: '🫓', chawal: '🍚', nashta: '🍳', meetha: '🍬',
  };
  return map[category] ?? '🍽️';
}
