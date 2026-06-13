'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Recipe, DietType } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';
import { IOSInstallBanner } from '@/components/IOSInstallPrompt/IOSInstallPrompt';

interface HomeClientProps {
  initialRecipes: Recipe[];
  regionalRecipes?: Recipe[];
  userName: string | null;
  subscriptionStatus: 'free' | 'paid';
  initialIsVrat: boolean;
  isAuthenticated: boolean;
  dietType: DietType | null;
  spicePreference?: string | null;
  cookedCount: number;
}

const WEEKDAYS_HI = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];

const CATEGORY_EMOJI: Record<string, string> = {
  sabzi: '🥬', dal: '🫘', roti: '🫓', chawal: '🍚',
  nashta: '🍳', meetha: '🍬', default: '🍽️',
};
const CATEGORY_BG: Record<string, string> = {
  sabzi: 'linear-gradient(135deg,#D4F1C4,#A8E063)',
  dal: 'linear-gradient(135deg,#FFE5B0,#FFCB6B)',
  roti: 'linear-gradient(135deg,#FFD8A8,#FFAE5E)',
  chawal: 'linear-gradient(135deg,#E8F4FD,#BFD9F2)',
  nashta: 'linear-gradient(135deg,#FDDBC2,#FBC08A)',
  meetha: 'linear-gradient(135deg,#F3D4F8,#E09EEA)',
  default: 'linear-gradient(135deg,#FDDBC2,#FBC08A)',
};

function timeSubtitle(): string {
  const h = new Date().getHours();
  const day = WEEKDAYS_HI[new Date().getDay()];
  if (h >= 6 && h < 11) return `${day} ki subah — nashte mein kya banayein? ☀️`;
  if (h >= 11 && h < 16) return `Dopahar ka khaana soch rahi hain? 🍽️`;
  if (h >= 16 && h < 19) return `Chai ke saath kuch snack? 🍵`;
  if (h >= 19 && h < 22) return `Dinner ka time ho gaya! 🌙`;
  return `Raat ka khaana soch rahi hain? 🌛`;
}

function FeaturedCard({ recipe, onClick, index }: { recipe: Recipe; onClick: () => void; index: number }) {
  const emoji = CATEGORY_EMOJI[recipe.category] ?? CATEGORY_EMOJI.default;
  const bg = CATEGORY_BG[recipe.category] ?? CATEGORY_BG.default;
  const totalMin = recipe.cook_time_minutes + recipe.prep_time_minutes;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-entry stagger-${Math.min(index + 1, 6)} tap-spring flex flex-shrink-0 flex-col overflow-hidden rounded-2xl text-left`}
      style={{ width: 170, height: 210, background: '#FFFFFF', border: '1px solid var(--border)' }}
    >
      {/* Image — top 65% */}
      <div className="relative w-full" style={{ height: '65%' }}>
        {recipe.thumbnail_url ? (
          <Image
            src={recipe.thumbnail_url}
            alt={recipe.name_hinglish}
            fill
            sizes="160px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl" style={{ background: bg }}>
            {emoji}
          </div>
        )}
        {recipe.is_vrat_friendly && (
          <span
            className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#2D6A4F' }}
          >
            🕉️
          </span>
        )}
      </div>

      {/* Text — bottom 35% */}
      <div className="flex flex-1 flex-col justify-between bg-white px-2.5 py-2">
        <p
          className="font-bold leading-tight"
          style={{ fontSize: 14, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {recipe.name_hinglish}
        </p>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>⏱ {totalMin} min</span>
          {recipe.rating_count >= 3 && (
            <span style={{ fontSize: 12, color: '#B45309' }}>⭐ {recipe.avg_rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// Local mirror of the API shape — do NOT add to types/index.ts
interface RecommendationGroup {
  reason: string;
  based_on_recipe: string;
  recipes: Recipe[];
}

interface FeatureCardDef {
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
  onClick: () => void;
}

export default function HomeClient({
  initialRecipes,
  regionalRecipes = [],
  userName,
  subscriptionStatus,
  initialIsVrat,
  isAuthenticated,
  dietType,
  spicePreference,
  cookedCount,
}: HomeClientProps) {
  const router = useRouter();
  const [isVrat, setIsVrat] = useState(initialIsVrat);
  const [vatLoading, setVatLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  // Time-based subtitle — compute after mount to avoid hydration mismatch
  const [subtitle, setSubtitle] = useState('Aaj kya banayein? 🍽️');
  useEffect(() => {
    setSubtitle(timeSubtitle());
  }, []);

  // "Banaya tha, toh yeh try karein" — personalized rows (auth + 1+ cook only)
  const [recGroups, setRecGroups] = useState<RecommendationGroup[]>([]);
  useEffect(() => {
    if (!isAuthenticated || cookedCount < 1) return;
    let cancelled = false;
    fetch('/api/recipes/recommendations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { groups?: RecommendationGroup[] } | null) => {
        if (cancelled || !data?.groups) return;
        // Skip the synthetic "popular" group — only genuine "banaya tha" rows
        const genuine = data.groups.filter(
          (g) => g.based_on_recipe && g.recipes.length > 0,
        );
        setRecGroups(genuine.slice(0, 2));
      })
      .catch(() => {
        /* silent — section simply doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, cookedCount]);

  const firstName = userName ? userName.split(' ')[0] : '';

  // Top 4 for "Aaj ke liye": vrat + diet filtered, then spice-sorted.
  // regionalRecipes are injected first (server guarantees dietary + regional match).
  // Global fill is spice-sorted so mild/hot users see matching recipes first.
  const dietVratFilter = (r: Recipe) => {
    if (isVrat && !r.is_vrat_friendly) return false;
    // Diet check: server already filtered by diet, but vrat-toggle can flip at runtime.
    if (dietType === 'veg' && r.diet_type !== 'veg') return false;
    return true;
  };

  // Spice sort: exact match = 0 (first), mismatch = 1, no pref = 0 (no reorder).
  const spiceScore = (r: Recipe) => {
    if (!spicePreference || spicePreference === 'medium') return 0;
    return r.spice_level === spicePreference ? 0 : 1;
  };

  const regionalFiltered = regionalRecipes.filter(dietVratFilter);
  const globalFiltered = recipes
    .filter(dietVratFilter)
    .sort((a, b) => spiceScore(a) - spiceScore(b));
  const seenFeaturedIds = new Set(regionalFiltered.map((r) => r.id));
  const globalFill = globalFiltered.filter((r) => !seenFeaturedIds.has(r.id));
  const featured = [...regionalFiltered, ...globalFill].slice(0, 4);

  async function onVratToggle() {
    setVatLoading(true);
    const res = await fetch('/api/users/vrat-toggle', { method: 'POST' });
    const data = await res.json();
    setIsVrat(data.is_vrat_mode);
    setVatLoading(false);
  }

  async function onSurprise() {
    if (surpriseLoading) return;
    setSurpriseLoading(true);
    try {
      const res = await fetch('/api/recipes/surprise');
      if (res.ok) {
        const data = await res.json();
        if (data?.recipe?.id) {
          router.push('/recipe/' + data.recipe.id);
          return;
        }
      }
      router.push('/search');
    } finally {
      setSurpriseLoading(false);
    }
  }

  const showExploreTeaser = !isAuthenticated || cookedCount < 5;

  const featureCards: FeatureCardDef[] = [
    // Warm-family gradients only (no purple) — dark stop at the bottom so the
    // white labels keep AA contrast where the text actually sits.
    {
      emoji: '📷', title: 'Fridge Scan', subtitle: 'Photo lo → recipe pao',
      gradient: 'linear-gradient(160deg, #E8640C, #BF4E06)',
      onClick: () => router.push('/fridge'),
    },
    {
      emoji: '💬', title: 'Chef Arti', subtitle: 'Koi bhi sawaal poochho',
      gradient: 'linear-gradient(160deg, #C4621E, #8C3D0F)',
      onClick: () => router.push('/chat'),
    },
    {
      emoji: '🍱', title: 'Bacha Hua', subtitle: 'Leftovers → naya dish',
      gradient: 'linear-gradient(160deg, #2D6A4F, #1E4A36)',
      onClick: () => router.push('/bacha-hua'),
    },
    {
      emoji: '🍽️', title: 'Aaj ki Thali', subtitle: 'Teen waqt ka plan',
      gradient: 'linear-gradient(160deg, #B23A2E, #7E2A20)',
      onClick: () => router.push('/aaj-ki-thali'),
    },
  ];

  return (
    <PullToRefresh onRefresh={() => router.refresh()}>
      {/* Sticky header: brand + vrat toggle + search bar */}
      <div
        className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3"
        style={{ boxShadow: '0 1px 0 var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>
            🍳 Chief-AI-Arti
          </p>
          {isAuthenticated && (
            <VratToggle isVrat={isVrat} onToggle={onVratToggle} loading={vatLoading} />
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push('/search')}
          className="tap-spring mt-2.5 flex h-12 w-full items-center gap-2 rounded-full px-4 text-left"
          style={{ background: 'var(--saffron-lt)' }}
        >
          <span className="text-[14px]" style={{ color: 'var(--muted)' }}>🔍 Kuch bhi dhundho...</span>
        </button>
      </div>

      {/* iOS Safari install banner — first visit only */}
      <IOSInstallBanner />

      {/* Greeting card */}
      <div
        className="page-enter mx-4 mt-3"
        style={{ background: '#FFF0E6', borderRadius: 16, padding: 16 }}
      >
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--terracotta)' }}>
          Namaskar{firstName ? `, ${firstName}` : ''}! 🙏
        </h2>
        <p className="mt-0.5" style={{ fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
      </div>

      {/* Feature grid */}
      <section className="mt-5 px-4">
        <p className="mb-2 font-semibold" style={{ fontSize: 15, color: 'var(--muted)' }}>
          Kya karna hai? 🍳
        </p>
        <div className="grid grid-cols-2 gap-2">
          {featureCards.map((card, i) => (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className={`card-entry stagger-${i + 1} tap-spring flex flex-col justify-between rounded-2xl p-3 text-left`}
              style={{ height: 108, background: card.gradient }}
            >
              <span className="text-[32px] leading-none">{card.emoji}</span>
              <span>
                <span className="block text-[15px] font-bold text-white">{card.title}</span>
                <span className="block text-[12px] text-white/90">{card.subtitle}</span>
              </span>
            </button>
          ))}
          {/* Surprise — full width */}
          <button
            type="button"
            onClick={onSurprise}
            className="card-entry stagger-5 tap-spring col-span-2 flex items-center gap-3 rounded-2xl px-4 text-left"
            style={{ height: 64, background: 'linear-gradient(160deg, #D97706, #B45309)' }}
          >
            <span className="text-[32px] leading-none">{surpriseLoading ? '⏳' : '🎲'}</span>
            <span>
              <span className="block text-[15px] font-bold text-white">Surprise karo!</span>
              <span className="block text-[12px] text-white/90">Naya kuch try karein</span>
            </span>
          </button>
        </div>
      </section>

      {/* Aaj ke liye — horizontal scroll of 4 */}
      <section className="mb-6 mt-6">
        <p className="px-4 text-[16px] font-bold" style={{ color: 'var(--terracotta)' }}>🍽️ Aaj ke liye</p>
        {featured.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Koi recipe nahi mili 😕</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
            {featured.map((r, i) => (
              <FeaturedCard key={r.id} recipe={r} index={i} onClick={() => router.push('/recipe/' + r.id)} />
            ))}
          </div>
        )}
      </section>

      {/* "Banaya tha, toh yeh try karein" — personalized recommendation rows */}
      {recGroups.map((group) => (
        <section key={group.based_on_recipe} className="mb-6">
          <p className="px-4 italic" style={{ fontSize: 13, color: 'var(--muted)' }}>
            {group.reason}
          </p>
          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
            {group.recipes.map((r, i) => (
              <FeaturedCard
                key={r.id}
                recipe={r}
                index={i}
                onClick={() => router.push('/recipe/' + r.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Naye Recipes explore teaser */}
      {showExploreTeaser && (
        <button
          type="button"
          onClick={() => router.push('/search')}
          className="tap-spring mx-4 flex w-[calc(100%-32px)] items-center justify-between rounded-2xl bg-white px-4 py-3 text-left"
          style={{ border: '1px solid #E8640C', minHeight: 52 }}
        >
          <span className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>🍲 100+ recipes explore karo</span>
          <span className="text-[16px] text-[#E8640C]">→</span>
        </button>
      )}

      <div className="pb-24" />

      {/* Floating AI chat — auth-only, general context */}
      {isAuthenticated && (
        <FloatingChatButton subscriptionStatus={subscriptionStatus} />
      )}
    </PullToRefresh>
  );
}
