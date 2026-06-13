'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { speakText, stopSpeaking } from '@/lib/tts';
import { useRouter } from 'next/navigation';
import { Recipe, Ingredient, UnitPreference, SubscriptionStatus } from '@/types/index';
import { scaleIngredients, shouldShowScalingWarning } from '@/lib/portion';
import { getIngredientEmoji } from '@/lib/emoji';
import Icon, { type IconName } from '@/components/editorial/Icon';
import DishImage from '@/components/editorial/DishArt';
import { SectionHead, Divider } from '@/components/editorial/SectionHead';
import PortionSelector from '@/components/PortionSelector/PortionSelector';
import TTSButton from '@/components/TTSButton/TTSButton';
import WhatsAppShare from '@/components/WhatsAppShare/WhatsAppShare';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import UpgradeModal from '@/components/UpgradeModal/UpgradeModal';
import LoginPromptModal from '@/components/LoginPromptModal/LoginPromptModal';
import NutritionDisplay from '@/components/NutritionDisplay/NutritionDisplay';
import { StarRatingInteractive, StarRatingDisplay } from '@/components/StarRating/StarRating';
import CommunityPhotos from '@/components/CommunityPhotos/CommunityPhotos';
import YouTubeEmbed from '@/components/YouTubeEmbed/YouTubeEmbed';
import PostCookSuggestions from '@/components/PostCookSuggestions/PostCookSuggestions';
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
  /** True when cooking_history already has this recipe for this user (rating allowed on revisit). */
  hasCookedBefore?: boolean;
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
  hasCookedBefore = false,
}: RecipeDetailClientProps) {
  const router = useRouter();

  // Derive values from user (with sensible defaults for unauthenticated / missing user)
  const familySize = user?.family_size ?? 4;
  const unitPreference: UnitPreference = user?.preferred_unit ?? 'desi';
  const subscriptionStatus: SubscriptionStatus = user?.subscription_status ?? 'free';
  const isPaid = subscriptionStatus === 'paid';

  // Free tier caps portions at 6 — a free user with family_size 8 must not
  // start above the cap (seats 7+ are locked in PortionSelector).
  const [portionSize, setPortionSize] = useState(isPaid ? familySize : Math.min(familySize, 6));
  const [cookedLoading, setCookedLoading] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [loginPromptFeature, setLoginPromptFeature] = useState('');
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

  // Inline cooking mode (steps highlighted in place)
  const [cookingActive, setCookingActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepSpeaking, setStepSpeaking] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Always open the recipe from the top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Hero entry: scale 1.05 → 1.0 over 400ms
  const [heroIn, setHeroIn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroIn(true));
    return () => cancelAnimationFrame(t);
  }, []);

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

  // Scroll active step into view while cooking
  useEffect(() => {
    if (cookingActive && activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cookingActive, activeStep]);

  // Stop step TTS when leaving cooking or changing step
  useEffect(() => {
    setStepSpeaking(false);
    stopSpeaking();
  }, [activeStep, cookingActive]);

  const speakStep = useCallback((text: string) => {
    if (stepSpeaking) {
      stopSpeaking();
      setStepSpeaking(false);
      return;
    }
    speakText(text, {
      onend: () => setStepSpeaking(false),
      onerror: () => setStepSpeaking(false),
    });
    setStepSpeaking(true);
  }, [stepSpeaking]);

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
  }

  function startCooking() {
    haptic('tap');
    setActiveStep(0);
    setCookingActive(true);
  }

  function goNextStep() {
    if (activeStep < recipe.steps.length - 1) {
      haptic('tap');
      setActiveStep(activeStep + 1);
    } else {
      // Finished — close inline cooking, fire existing "Bana liya!" flow
      haptic('success');
      setCookingActive(false);
      handleCooked();
    }
  }

  function goPrevStep() {
    if (activeStep > 0) {
      haptic('tap');
      setActiveStep(activeStep - 1);
    }
  }

  const totalMinutes = recipe.prep_time_minutes + recipe.cook_time_minutes;
  const totalSteps = recipe.steps.length;
  const cookProgress = ((activeStep + 1) / Math.max(totalSteps, 1)) * 100;

  const REGION_LABEL: Record<string, string> = {
    'pan-north-indian': 'North India',
  };

  return (
    <div className="min-h-screen pb-32" style={{ background: 'var(--cream)' }}>
      {/* Hero — full-bleed photo (or DishArt fallback), 290px, tadka sweep */}
      <div className="tadka-host" style={{ position: 'relative', height: 290 }}>
        <div
          className="absolute inset-0"
          style={{ transform: heroIn ? 'scale(1)' : 'scale(1.05)', transition: 'transform 400ms ease-out' }}
        >
          <DishImage recipe={recipe} big priority sizes="100vw" style={{ position: 'absolute', inset: 0 }} />
        </div>

        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(44,24,16,0.25) 0%, transparent 35%, transparent 55%, rgba(44,24,16,0.65) 100%)' }}
        />

        {/* YouTube-frame placeholder attribution */}
        {recipe.thumbnail_source === 'youtube-temp' && (
          <p className="pointer-events-none absolute bottom-1 right-2 text-white/80" style={{ fontSize: 10, zIndex: 3 }}>
            📺 Source: YouTube
          </p>
        )}

        {/* Overlay back button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Wapas jao"
          className="tap-spring absolute left-3 top-3 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(6px)', height: 48, width: 48, zIndex: 3 }}
        >
          <Icon name="back" size={20} color="#fff" />
        </button>

        {/* Overlay heart button */}
        <button
          type="button"
          onClick={handleSaveToggle}
          aria-label={isSaved ? 'Save hata do' : 'Recipe save karo'}
          className="tap-spring absolute right-3 top-3 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(44,24,16,0.45)', backdropFilter: 'blur(6px)', height: 48, width: 48, zIndex: 3 }}
        >
          <span key={isSaved ? 'saved' : 'unsaved'} className={isSaved ? 'heart-pop animate-heart-pop' : ''}>
            <Icon name="heart" size={22} color={isSaved ? '#C0392B' : '#fff'} />
          </span>
        </button>

        {/* Vibes + Playfair title + hindi name */}
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, zIndex: 3 }}>
          {recipe.vibes.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {recipe.vibes.slice(0, 3).map((vibe) => (
                <span key={vibe} style={{ background: 'rgba(255,248,240,0.92)', color: 'var(--hero-dk)', fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 99 }}>
                  {vibe}
                </span>
              ))}
            </div>
          )}
          <h1 className="t-display" style={{ color: '#fff', fontSize: 30, margin: 0, lineHeight: 1.15, textShadow: '0 2px 12px rgba(44,24,16,0.4)' }}>
            {recipe.name_hinglish}
          </h1>
          {recipe.name_hindi && (
            <div className="t-hindi" style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, marginTop: 2 }}>{recipe.name_hindi}</div>
          )}
        </div>
      </div>

      {/* Info pills — horizontal scroll */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 18px 0' }}>
        <RPill icon="clock">{totalMinutes} min</RPill>
        <RPill icon="users">{portionSize} log</RPill>
        <RPill icon="chili">{recipe.spice_level}</RPill>
        <RPill icon="wheat">{REGION_LABEL[recipe.region_origin] ?? recipe.region_origin}</RPill>
        {ratingCount >= 3 && <RPill icon="star">{avgRating.toFixed(1)}</RPill>}
        {recipe.soak_required && <RPill icon="clock">Raat bhar bhigao</RPill>}
      </div>

      <div className="flex flex-col gap-4 px-[18px] py-4">
        {/* Description */}
        {recipe.description && (
          <p style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.55 }}>{recipe.description}</p>
        )}

        {/* Rating display */}
        {ratingCount >= 3 && (
          <StarRatingDisplay avg_rating={avgRating} rating_count={ratingCount} size="md" />
        )}

        {/* Banana Shuru Karein CTA */}
        {!cookingActive && (
          <button type="button" onClick={startCooking} className="r-cta tap-spring">
            <Icon name="flame" size={20} color="#fff" /> Banana Shuru Karein
          </button>
        )}

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
              <p className="text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>
                Namak thoda-thoda milao — ek baar mein mat daal dena.
              </p>
            </div>
          )}
        </div>

        <Divider />

        {/* Ingredients — 2-col emoji cards */}
        <section>
          <SectionHead over="Samagri" title="Kya kya chahiye" style={{ marginBottom: 14 }} />
          <div className="grid grid-cols-2 gap-3">
            {scaledIngredients.map((ing, i) => (
              <div
                key={`${ing.name}-${i}`}
                className="card-entry r-card flex flex-col items-center text-center"
                style={{
                  padding: 14,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span className="leading-none" style={{ fontSize: 28 }}>
                  {getIngredientEmoji(ing.name)}
                </span>
                <p className="mt-1.5 w-full break-words font-bold leading-tight" style={{ fontSize: 14, color: 'var(--text)' }}>
                  {ing.name}
                  {ing.prep ? ` (${ing.prep})` : ''}
                </p>
                <p className="mt-0.5 w-full break-words font-semibold" style={{ fontSize: 14, color: 'var(--saffron-dk)' }}>
                  {unitPreference === 'metric' ? ing.qty_metric : ing.qty_desi}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps — Vidhi */}
        <section ref={stepsRef}>
          <SectionHead over="Vidhi" title="Kaise banayein" style={{ marginBottom: 14 }} />

          {/* Progress bar while cooking */}
          {cookingActive && (
            <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${cookProgress}%`, background: 'var(--saffron)' }}
              />
            </div>
          )}

          <div className="flex flex-col" style={{ gap: 10 }}>
            {recipe.steps.map((step, idx) => {
              const isActive = cookingActive && idx === activeStep;
              const isDone = cookingActive && idx < activeStep;
              const isFuture = cookingActive && idx > activeStep;
              return (
                <div key={step.step} ref={isActive ? activeStepRef : undefined}>
                  <div
                    className="flex gap-3 rounded-xl bg-white p-3 transition-all duration-300"
                    style={{
                      borderLeft: isActive ? '4px solid var(--saffron)' : '3px solid var(--border)',
                      background: isActive ? '#FFF0E6' : '#FFFFFF',
                      opacity: isDone ? 0.6 : isFuture ? 0.4 : 1,
                    }}
                  >
                    <div
                      className="flex flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                      style={{
                        height: 28,
                        width: 28,
                        background: isDone ? 'var(--green)' : 'var(--saffron)',
                      }}
                    >
                      {isDone ? '✓' : step.step}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}>{step.instruction}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {step.time_minutes > 0 && (
                          <span className="r-pill" style={{ height: 26, padding: '0 10px', fontSize: 12 }}>
                            <Icon name="clock" size={12} color="var(--hero-dk)" /> {step.time_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => speakStep(step.instruction)}
                        aria-label={stepSpeaking ? 'Awaaz band karo' : 'Step suno'}
                        className="tap-spring flex flex-shrink-0 items-center justify-center self-start rounded-full"
                        style={{ height: 48, width: 48, background: stepSpeaking ? 'var(--hero)' : 'var(--hero-lt)' }}
                      >
                        <Icon name="speaker" size={20} color={stepSpeaking ? '#fff' : 'var(--hero-dk)'} />
                      </button>
                    )}
                  </div>

                  {/* Inline cooking nav — below the active step */}
                  {isActive && (
                    <div className="animate-fade-in-up mt-2.5">
                      <p className="mb-2 text-center text-[13px] font-medium" style={{ color: 'var(--muted)' }}>
                        {activeStep + 1} / {totalSteps} step
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={goPrevStep}
                          disabled={activeStep === 0}
                          className="tap-spring flex flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold disabled:opacity-30"
                          style={{ height: 48, background: '#FFFFFF', border: '2px solid var(--hero)', color: 'var(--hero-dk)' }}
                        >
                          <Icon name="back" size={17} color="var(--hero-dk)" /> Pichla
                        </button>
                        <button
                          type="button"
                          onClick={goNextStep}
                          className="tap-spring flex flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold text-white"
                          style={{ height: 48, background: 'var(--hero)' }}
                        >
                          {activeStep === totalSteps - 1 ? (
                            'Ho Gaya! 🎉'
                          ) : (
                            <>
                              Agla <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><Icon name="back" size={17} color="#fff" /></span>
                            </>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCookingActive(false)}
                        className="mt-2 w-full text-center text-[13px] underline"
                        style={{ color: 'var(--muted)', minHeight: 48 }}
                      >
                        Cooking band karo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Goes well with */}
        {recipe.goes_well_with.length > 0 && (
          <p className="t-caption" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="thali" size={15} color="var(--muted)" /> Ke saath: {recipe.goes_well_with.join(', ')}
          </p>
        )}

        {/* YouTube source video — only for YouTube-pipeline recipes */}
        {recipe.youtube_video_id && (
          <YouTubeEmbed
            videoId={recipe.youtube_video_id}
            channelName={recipe.youtube_channel_name ?? null}
            title={recipe.name_hinglish}
          />
        )}

        {/* Collapsible Nutrition */}
        {recipe.nutrition && (
          <div>
            <button
              type="button"
              onClick={() => setNutritionOpen(!nutritionOpen)}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold"
              style={{ background: '#FFF0E6', border: '1px solid var(--border)', minHeight: 48, color: 'var(--text)' }}
            >
              <span>🥗 Nutrition Details</span>
              <span
                className="transition-transform duration-200"
                style={{ color: 'var(--muted)', transform: nutritionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
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
            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold"
            style={{ background: '#FFF0E6', border: '1px solid var(--border)', minHeight: 48, color: 'var(--text)' }}
          >
            <span>📸 Community Photos</span>
            <span
              className="transition-transform duration-200"
              style={{ color: 'var(--muted)', transform: photosOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▾
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: photosOpen ? 500 : 0, opacity: photosOpen ? 1 : 0 }}
          >
            <div className="pt-2">
              <CommunityPhotos recipeId={recipe.id} />
            </div>
          </div>
        </div>

        {/* Bana liya button */}
        <button
          type="button"
          onClick={handleCooked}
          disabled={cooked || cookedLoading}
          className="tap-spring flex h-14 w-full items-center justify-center rounded-2xl text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
          style={{ background: cooked ? '#16A34A' : 'linear-gradient(160deg, #E8640C, #BF4E06)' }}
        >
          {cookedLoading ? 'Save ho raha hai...' : cooked ? '✅ Bana liya! Shukriya!' : '✅ Bana liya!'}
        </button>

        {/* Rating section — after cooking now OR on revisit if cooked before */}
        {isAuthenticated && (cooked || hasCookedBefore) && (
          <div className="mt-3 rounded-xl bg-white px-4 py-3" style={{ border: '1px solid var(--border)' }}>
            {!ratingSubmitted ? (
              <>
                <p className="mb-2 text-[13px] font-medium" style={{ color: 'var(--saffron-dk)' }}>
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
                <p className="mb-2 text-[13px]" style={{ color: 'var(--green)' }}>
                  Shukriya! Aapki rating save ho gayi 🙏
                </p>
                <div className="flex items-center gap-3">
                  <StarRatingInteractive
                    value={userRating}
                    onChange={handleRating}
                    size="sm"
                    disabled={ratingLoading}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Rating badal sakte ho</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Similar recipes after cooking */}
        {cooked && (
          <PostCookSuggestions recipeId={recipe.id} recipeName={recipe.name_hinglish} />
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

function RPill({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="r-pill" style={{ flexShrink: 0 }}>
      <Icon name={icon} size={15} color="var(--hero-dk)" /> {children}
    </span>
  );
}
