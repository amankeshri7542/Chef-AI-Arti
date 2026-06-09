'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, Ingredient, UnitPreference, SubscriptionStatus, VibeBadgeKey } from '@/types/index';
import { scaleIngredients, shouldShowScalingWarning } from '@/lib/portion';
import PortionSelector from '@/components/PortionSelector/PortionSelector';
import TTSButton from '@/components/TTSButton/TTSButton';
import VibeBadges from '@/components/VibeBadges/VibeBadges';
import WhatsAppShare from '@/components/WhatsAppShare/WhatsAppShare';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import LoginPromptModal from '@/components/LoginPromptModal/LoginPromptModal';
import NutritionDisplay from '@/components/NutritionDisplay/NutritionDisplay';
import { StarRatingInteractive, StarRatingDisplay } from '@/components/StarRating/StarRating';
import CommunityPhotos from '@/components/CommunityPhotos/CommunityPhotos';
import CookingMode from '@/components/CookingMode/CookingMode';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';

interface UserProps {
  family_size: number;
  subscription_status: SubscriptionStatus;
  preferred_unit: UnitPreference;
  is_vrat_mode: boolean;
}

interface RecipeDetailClientProps {
  recipe: Recipe;
  user: UserProps | null;
  isAuthenticated: boolean;
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
  user,
  isAuthenticated,
}: RecipeDetailClientProps) {
  const router = useRouter();

  // Derive values from user (with sensible defaults for unauthenticated / missing user)
  const familySize = user?.family_size ?? 4;
  const unitPreference: UnitPreference = user?.preferred_unit ?? 'desi';
  const subscriptionStatus: SubscriptionStatus = user?.subscription_status ?? 'free';
  const isPaid = subscriptionStatus === 'paid';

  const [portionSize, setPortionSize] = useState(familySize);
  const [cookedLoading, setCookedLoading] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [loginPromptFeature, setLoginPromptFeature] = useState('');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [thumbnailUploaded, setThumbnailUploaded] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(recipe.avg_rating ?? 0);
  const [ratingCount, setRatingCount] = useState(recipe.rating_count ?? 0);

  // Heart/save state
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Collapsible sections
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  // Cooking mode
  const [showCookingMode, setShowCookingMode] = useState(false);

  // Fetch user's existing rating on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`/api/recipes/${recipe.id}/rating`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user_rating) {
          setUserRating(data.user_rating);
          setRatingSubmitted(true);
        }
      })
      .catch(() => {});
  }, [recipe.id, isAuthenticated]);

  // Fetch save state on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`/api/recipes/${recipe.id}/save`)
      .then((r) => r.json())
      .then((data) => {
        if (data.saved) setIsSaved(true);
      })
      .catch(() => {});
  }, [recipe.id, isAuthenticated]);

  async function handleSaveToggle() {
    if (!isAuthenticated) {
      showLoginPrompt('Recipe save karne');
      return;
    }
    if (saveLoading) return;
    setSaveLoading(true);
    // Optimistic update
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    haptic('tap');
    if (!wasSaved) toast.success('Recipe save ho gayi ❤️');
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/save`, {
        method: wasSaved ? 'DELETE' : 'POST',
      });
      if (!res.ok) {
        setIsSaved(wasSaved); // Rollback
      }
    } catch {
      setIsSaved(wasSaved); // Rollback
    } finally {
      setSaveLoading(false);
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
      if (res.ok) {
        const data = await res.json();
        setUserRating(rating);
        setRatingSubmitted(true);
        setAvgRating(data.avg_rating);
        setRatingCount(data.rating_count);
      }
    } catch {
      // silent fail
    } finally {
      setRatingLoading(false);
    }
  }

  const scaledIngredients = scaleIngredients(recipe.ingredients, recipe.base_family_size, portionSize);

  function showLoginPrompt(feature: string) {
    setLoginPromptFeature(feature);
    setLoginPromptOpen(true);
  }

  async function handleCooked() {
    if (!isAuthenticated) {
      showLoginPrompt('Bana liya mark karne');
      return;
    }
    if (cooked || cookedLoading) return;
    setCookedLoading(true);
    await fetch(`/api/recipes/${recipe.id}/cooked`, { method: 'POST' });
    setCookedLoading(false);
    setCooked(true);
    haptic('success');
    setShowPhotoPrompt(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // Use browser-image-compression if available; fallback to raw file
      let compressed: File | Blob = file;
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        compressed = await imageCompression(file, { maxWidthOrHeight: 800, useWebWorker: true });
      } catch {
        // skip compression if library not available
      }
      const fd = new FormData();
      fd.append('image', compressed, file.name);
      const res = await fetch(`/api/recipes/${recipe.id}/thumbnail`, { method: 'POST', body: fd });
      if (res.ok) {
        setThumbnailUploaded(true);
        setShowPhotoPrompt(false);
        toast.success('Photo save ho gayi! Shukriya 🙏');
      } else {
        toast.error('Upload nahi hua. Dobara try karein.');
      }
    } catch {
      toast.error('Upload nahi hua. Dobara try karein.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  const totalMinutes = recipe.prep_time_minutes + recipe.cook_time_minutes;

  // Cooking Mode overlay
  if (showCookingMode) {
    return (
      <CookingMode
        recipe={recipe}
        portionSize={portionSize}
        unitPreference={unitPreference}
        onExit={() => setShowCookingMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-32">
      {/* Hero thumbnail */}
      <div
        className="relative flex h-56 w-full items-center justify-center text-6xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #FDDBC2, #FBC08A)',
        }}
      >
        {recipe.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.thumbnail_url}
            alt={recipe.name_hinglish}
            className="h-full w-full object-cover"
          />
        ) : (
          getCategoryEmoji(recipe.category)
        )}

        {/* Overlay back button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Wapas jao"
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white text-lg transition-opacity active:opacity-70"
          style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', minHeight: 44, minWidth: 44 }}
        >
          ←
        </button>

        {/* Overlay heart button */}
        <button
          type="button"
          onClick={handleSaveToggle}
          aria-label={isSaved ? 'Unsave recipe' : 'Save recipe'}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-lg transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', minHeight: 44, minWidth: 44 }}
        >
          <span key={isSaved ? 'saved' : 'unsaved'} className={isSaved ? 'animate-heart-pop' : ''}>
            {isSaved ? '❤️' : '🤍'}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Name + meta */}
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A1A]">{recipe.name_hinglish}</h1>
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

        {/* Rating display */}
        {ratingCount >= 3 && (
          <div className="mt-0">
            <StarRatingDisplay avg_rating={avgRating} rating_count={ratingCount} size="md" />
          </div>
        )}

        {/* 🍳 Banana shuru karein CTA */}
        <button
          type="button"
          onClick={() => { haptic('tap'); setShowCookingMode(true); }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #E8640C, #F5A55B)',
            boxShadow: '0 4px 16px rgba(232,100,12,0.35)',
          }}
        >
          <span className="text-[20px]">🍳</span>
          Banana shuru karein
        </button>

        {/* Portion selector + actions */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <PortionSelector
              baseSize={recipe.base_family_size}
              currentSize={portionSize}
              onChange={setPortionSize}
              subscriptionStatus={subscriptionStatus}
              onUpgradeClick={() => setUpgradeOpen(true)}
            />
            <div className="flex gap-2">
              <TTSButton text={ttsText(recipe, scaledIngredients, portionSize)} />
              <WhatsAppShare
                recipeName={recipe.name_hinglish}
                recipeId={recipe.id}
                isPaid={isPaid}
                onUpgradeClick={isAuthenticated ? () => setUpgradeOpen(true) : () => showLoginPrompt('WhatsApp share')}
              />
            </div>
          </div>
          {shouldShowScalingWarning(recipe.base_family_size, portionSize) && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-[#FFF7ED] px-3 py-2" style={{ border: '1px solid #FBC08A' }}>
              <span className="text-[13px] leading-none">⚠️</span>
              <p className="text-[12px] leading-snug text-[#8B6B4A]">
                Namak thoda-thoda milao — ek baar mein mat daal dena.
              </p>
            </div>
          )}
        </div>

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

        {/* Goes well with */}
        {recipe.goes_well_with.length > 0 && (
          <p className="text-[12px] text-[#8B7355]">
            🍽 Ke saath: {recipe.goes_well_with.join(', ')}
          </p>
        )}

        {/* Collapsible Nutrition */}
        {recipe.nutrition && (
          <div>
            <button
              type="button"
              onClick={() => setNutritionOpen(!nutritionOpen)}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]"
              style={{ background: '#FFF0E6', border: '1px solid #E8DDD0', minHeight: 48 }}
            >
              <span>🥗 Nutrition Details</span>
              <span
                className="text-[#8B7355] transition-transform duration-200"
                style={{ transform: nutritionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▾
              </span>
            </button>
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ maxHeight: nutritionOpen ? 300 : 0, opacity: nutritionOpen ? 1 : 0 }}
            >
              <div className="pt-2">
                <NutritionDisplay
                  nutrition={recipe.nutrition}
                  currentServings={portionSize}
                  baseServings={recipe.base_family_size}
                />
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Community Photos */}
        <div>
          <button
            type="button"
            onClick={() => setPhotosOpen(!photosOpen)}
            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]"
            style={{ background: '#FFF0E6', border: '1px solid #E8DDD0', minHeight: 48 }}
          >
            <span>📸 Community Photos</span>
            <span
              className="text-[#8B7355] transition-transform duration-200"
              style={{ transform: photosOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▾
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: photosOpen ? 500 : 0, opacity: photosOpen ? 1 : 0 }}
          >
            <div className="pt-2">
              <CommunityPhotos
                recipeId={recipe.id}
                isAuthenticated={isAuthenticated}
                hasCooked={cooked}
              />
            </div>
          </div>
        </div>

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

        {/* Photo upload prompt after cooking */}
        {showPhotoPrompt && !thumbnailUploaded && (
          <div className="mt-3 rounded-xl border border-[#F5A55B] bg-[#FFF7F0] p-4">
            <p className="text-sm font-semibold text-[#1A1A1A]">
              Wah! 🎉 Kya aapka dish acha bana?
            </p>
            <p className="mt-1 text-xs text-[#8B7355]">
              Apne pakaye khane ki photo upload karein! Aapki photo recipe card pe dikhegi ❤️
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="flex-1 rounded-lg bg-[#E8640C] py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {uploadingPhoto ? 'Upload ho rahi hai...' : '📸 Photo upload karo'}
              </button>
              <button
                onClick={() => setShowPhotoPrompt(false)}
                className="px-3 text-xs text-[#8B7355]"
              >
                Abhi nahi
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        )}
        {thumbnailUploaded && (
          <p className="mt-2 text-center text-xs text-[#2D6A4F]">
            Shukriya! Aapki photo save ho gayi 🙏
          </p>
        )}

        {/* Rating section — only after user has cooked */}
        {isAuthenticated && cooked && (
          <div className="mt-3 rounded-xl border border-[#E8DDD0] bg-white px-4 py-3">
            {!ratingSubmitted ? (
              <>
                <p className="text-[12px] font-medium text-[#E8640C] mb-2">
                  Kaise bana? Rating do! ⭐
                </p>
                <StarRatingInteractive
                  value={userRating}
                  onChange={handleRating}
                  size="md"
                  disabled={ratingLoading}
                />
              </>
            ) : (
              <>
                <p className="text-[11px] text-[#2D6A4F] mb-2">
                  Shukriya! Aapki rating save ho gayi 🙏
                </p>
                <div className="flex items-center gap-3">
                  <StarRatingInteractive
                    value={userRating}
                    onChange={handleRating}
                    size="sm"
                    disabled={ratingLoading}
                  />
                  <span className="text-[10px] text-[#8B7355]">Rating badal sakte ho</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating chat button */}
      {isAuthenticated ? (
        <FloatingChatButton recipeId={recipe.id} recipeName={recipe.name_hinglish} subscriptionStatus={subscriptionStatus} />
      ) : (
        <button
          type="button"
          onClick={() => showLoginPrompt('Chat')}
          className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
          style={{ background: '#E8640C' }}
          aria-label="Chat kholo"
        >
          <span className="text-2xl">💬</span>
        </button>
      )}

      {/* Upgrade modal */}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      {/* Login prompt modal */}
      <LoginPromptModal
        isOpen={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        feature={loginPromptFeature}
      />
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
