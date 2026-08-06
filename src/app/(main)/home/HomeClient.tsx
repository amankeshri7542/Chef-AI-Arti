'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, DietType } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';
import { IOSInstallBanner } from '@/components/IOSInstallPrompt/IOSInstallPrompt';
import Icon, { type IconName } from '@/components/editorial/Icon';
import { Steam } from '@/components/editorial/DishArt';
import { Divider, SectionHead } from '@/components/editorial/SectionHead';
import { RecipeCardV } from '@/components/editorial/RecipeCards';

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

const WEEKDAYS_HI = ['Ravivar', 'Somvar', 'Mangalvar', 'Budhvar', 'Guruvar', 'Shukravar', 'Shanivar'];

function timeSubtitle(): string {
  const now = new Date();
  const hour = now.getHours();
  const day = WEEKDAYS_HI[now.getDay()];
  if (hour >= 6 && hour < 11) return `${day} ki subah. Nashta aasaan rakhte hain.`;
  if (hour >= 11 && hour < 16) return 'Dopahar ka khaana bina overthinking ke plan karein.';
  if (hour >= 16 && hour < 19) return 'Chai ke saath kuch jaldi aur tasty banayein.';
  if (hour >= 19 && hour < 22) return 'Dinner ka time hai. Aaj ka decision Arti par chhodiye.';
  return 'Kal ki rasoi abhi se halka sa plan kar lein.';
}

interface RecommendationGroup {
  reason: string;
  based_on_recipe: string;
  recipes: Recipe[];
}

interface FeatureCardDef {
  icon: IconName;
  title: string;
  subtitle: string;
  bg: string;
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
  const [vratLoading, setVratLoading] = useState(false);
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [subtitle, setSubtitle] = useState('Aaj ki rasoi aasaan banate hain.');
  const [recGroups, setRecGroups] = useState<RecommendationGroup[]>([]);

  useEffect(() => {
    setSubtitle(timeSubtitle());
  }, []);

  useEffect(() => {
    if (!isAuthenticated || cookedCount < 1) return;
    let cancelled = false;

    fetch('/api/recipes/recommendations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { groups?: RecommendationGroup[] } | null) => {
        if (cancelled || !data?.groups) return;
        const genuine = data.groups.filter((group) => group.based_on_recipe && group.recipes.length > 0);
        setRecGroups(genuine.slice(0, 2));
      })
      .catch(() => {
        // Recommendations are optional. Home remains useful without them.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, cookedCount]);

  const firstName = userName ? userName.split(' ')[0] : '';

  const dietVratFilter = (recipe: Recipe) => {
    if (isVrat && !recipe.is_vrat_friendly) return false;
    if (dietType === 'veg' && recipe.diet_type !== 'veg') return false;
    return true;
  };

  const spiceScore = (recipe: Recipe) => {
    if (!spicePreference || spicePreference === 'medium') return 0;
    return recipe.spice_level === spicePreference ? 0 : 1;
  };

  const regionalFiltered = regionalRecipes.filter(dietVratFilter);
  const globalFiltered = recipes.filter(dietVratFilter).sort((a, b) => spiceScore(a) - spiceScore(b));
  const seenFeaturedIds = new Set(regionalFiltered.map((recipe) => recipe.id));
  const globalFill = globalFiltered.filter((recipe) => !seenFeaturedIds.has(recipe.id));
  const featured = [...regionalFiltered, ...globalFill].slice(0, 4);

  async function onVratToggle() {
    if (vratLoading) return;
    setVratLoading(true);
    try {
      const response = await fetch('/api/users/vrat-toggle', { method: 'POST' });
      if (!response.ok) return;
      const data: { is_vrat_mode?: boolean } = await response.json();
      setIsVrat(Boolean(data.is_vrat_mode));
    } finally {
      setVratLoading(false);
    }
  }

  async function onSurprise() {
    if (surpriseLoading) return;
    setSurpriseLoading(true);
    try {
      const response = await fetch('/api/recipes/surprise');
      if (response.ok) {
        const data = await response.json();
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
    { icon: 'camera', title: 'Fridge Scan', subtitle: 'Photo lo, ingredients pehchano', bg: 'var(--tile-1)', onClick: () => router.push('/fridge') },
    { icon: 'chat', title: 'Chef Arti', subtitle: 'Normal Hinglish mein poochho', bg: 'var(--tile-2)', onClick: () => router.push('/chat') },
    { icon: 'pot', title: 'Bacha Hua', subtitle: 'Leftovers ko nayi dish banao', bg: 'var(--tile-3)', onClick: () => router.push('/bacha-hua') },
    { icon: 'thali', title: 'Aaj ki Thali', subtitle: 'Teen waqt ka simple plan', bg: 'var(--tile-4)', onClick: () => router.push('/aaj-ki-thali') },
  ];

  return (
    <PullToRefresh onRefresh={() => router.refresh()}>
      <div className="app-screen safe-bottom" data-vrat={isVrat ? 'on' : 'off'}>
        <header className="screen-header sticky top-0 z-20" style={{ padding: '10px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Chef Arti</div>
              <div className="t-ital truncate" style={{ fontSize: 17, color: 'var(--text)' }}>Aaj kya banao?</div>
            </div>
            {isAuthenticated && <VratToggle isVrat={isVrat} onToggle={onVratToggle} loading={vratLoading} />}
          </div>

          <button type="button" onClick={() => router.push('/search')} className="search-launch tap-spring flex w-full items-center gap-3 px-4 text-left" aria-label="Recipe search kholein">
            <Icon name="search" size={19} color="var(--hero-dk)" />
            <span className="flex-1 text-[14.5px]" style={{ color: 'var(--muted)' }}>Dish, ingredient ya mood se dhundho</span>
            <span className="r-pill" style={{ height: 30, padding: '0 10px', fontSize: 11, color: 'var(--hero-dk)' }}>Khoj</span>
          </button>
        </header>

        <IOSInstallBanner />

        <section style={{ padding: '18px 18px 0' }}>
          <div className="home-hero r-card card-entry stg-1">
            <div className="absolute right-4 top-4 opacity-80" aria-hidden><Steam size={34} color="var(--terracotta)" /></div>
            <div className="t-overline" style={{ color: 'var(--hero-dk)', marginBottom: 8 }}>Aaj ki rasoi</div>
            <h1 className="t-display" style={{ fontSize: 29, margin: '0 0 7px', color: 'var(--text)', maxWidth: 330 }}>Namaskar{firstName ? `, ${firstName}` : ''}</h1>
            <p style={{ margin: 0, maxWidth: 360, color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6 }}>{subtitle}</p>
          </div>
        </section>

        <section style={{ padding: '24px 18px 0' }}>
          <SectionHead over="Quick actions" title="Kaise madad chahiye?" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            {featureCards.map((feature, index) => (
              <button key={feature.title} type="button" onClick={feature.onClick} className={`feature-card tap-spring card-entry stg-${index + 1}`} style={{ background: feature.bg, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                <span className="feature-card__icon"><Icon name={feature.icon} size={23} color="#fff" /></span>
                <span className="relative z-[1]">
                  <span style={{ display: 'block', fontSize: 16.5, fontWeight: 700, letterSpacing: '-.01em' }}>{feature.title}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: .9, marginTop: 3, lineHeight: 1.35 }}>{feature.subtitle}</span>
                </span>
              </button>
            ))}
          </div>

          <button type="button" onClick={onSurprise} disabled={surpriseLoading} aria-busy={surpriseLoading} className="surprise-card tap-spring r-card card-entry stg-5 mt-3 flex min-h-16 w-full items-center gap-3 px-4 text-left disabled:opacity-60">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px]" style={{ background: 'var(--hero-lt)' }}><Icon name="dice" size={22} color="var(--terracotta)" /></span>
            <span className="flex-1">
              <span style={{ display: 'block', fontWeight: 650, fontSize: 15, color: 'var(--text)' }}>{surpriseLoading ? 'Aapke liye dhundh rahe hain…' : 'Decision Arti par chhodo'}</span>
              <span className="t-caption">Ek achhi recipe surprise mein pao</span>
            </span>
            <Icon name="chevR" size={18} color="var(--muted)" />
          </button>
        </section>

        <div style={{ padding: '24px 18px 0' }}><Divider /></div>

        <section style={{ paddingTop: 17 }}>
          <SectionHead over={isVrat ? 'Vrat special' : 'Aaj ke liye'} title={isVrat ? 'Phalahari options' : 'Arti ki pasand'} action="Sab dekhein" onAction={() => router.push('/search')} style={{ padding: '0 18px' }} />
          {featured.length === 0 ? (
            <div className="mx-[18px] mt-4 rounded-[20px] border border-dashed p-6 text-center" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Is preference ke liye abhi recipe nahi mili.</div>
          ) : (
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 8px' }}>
              {featured.map((recipe, index) => <RecipeCardV key={recipe.id} recipe={recipe} idx={index} onOpen={(id) => router.push('/recipe/' + id)} />)}
            </div>
          )}
        </section>

        {recGroups.map((group) => (
          <section key={group.based_on_recipe} style={{ paddingTop: 18 }}>
            <div style={{ padding: '0 18px' }}>
              <SectionHead over="Aapke swaad se" title="Yeh bhi pasand aa sakta hai" />
              <p className="t-caption" style={{ margin: '5px 0 0' }}>{group.reason}</p>
            </div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 8px' }}>
              {group.recipes.map((recipe, index) => <RecipeCardV key={recipe.id} recipe={recipe} idx={index} onOpen={(id) => router.push('/recipe/' + id)} />)}
            </div>
          </section>
        ))}

        {showExploreTeaser && (
          <div style={{ padding: '20px 18px 8px' }}>
            <button type="button" onClick={() => router.push('/search')} className="tap-spring r-card flex min-h-16 w-full items-center justify-between px-4 text-left">
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[15px]" style={{ background: 'var(--hero-lt)' }}><Icon name="search" size={20} color="var(--hero-dk)" /></span>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 650, color: 'var(--text)' }}>200+ recipes ki library</span>
                  <span className="t-caption">Cuisine, time aur ingredients se browse karein</span>
                </span>
              </span>
              <Icon name="chevR" size={18} color="var(--muted)" />
            </button>
          </div>
        )}

        {isAuthenticated && <FloatingChatButton subscriptionStatus={subscriptionStatus} />}
      </div>
    </PullToRefresh>
  );
}
