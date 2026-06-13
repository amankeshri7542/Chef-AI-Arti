'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, DietType } from '@/types/index';
import VratToggle from '@/components/VratToggle/VratToggle';
import FloatingChatButton from '@/components/FloatingChatButton/FloatingChatButton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';
import { IOSInstallBanner } from '@/components/IOSInstallPrompt/IOSInstallPrompt';
import Icon, { type IconName } from '@/components/editorial/Icon';
import { Steam } from '@/components/editorial/DishArt';
import { SectionHead, Divider } from '@/components/editorial/SectionHead';
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
  const h = new Date().getHours();
  const day = WEEKDAYS_HI[new Date().getDay()];
  if (h >= 6 && h < 11) return `${day} ki subah — nashte mein kya banayein? ☀️`;
  if (h >= 11 && h < 16) return `Dopahar ka khaana soch rahi hain? 🍽️`;
  if (h >= 16 && h < 19) return `Chai ke saath kuch snack? 🍵`;
  if (h >= 19 && h < 22) return `Dinner ka time ho gaya! 🌙`;
  return `Raat ka khaana soch rahi hain? 🌛`;
}

// Local mirror of the API shape — do NOT add to types/index.ts
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
        const genuine = data.groups.filter((g) => g.based_on_recipe && g.recipes.length > 0);
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
  const dietVratFilter = (r: Recipe) => {
    if (isVrat && !r.is_vrat_friendly) return false;
    if (dietType === 'veg' && r.diet_type !== 'veg') return false;
    return true;
  };
  const spiceScore = (r: Recipe) => {
    if (!spicePreference || spicePreference === 'medium') return 0;
    return r.spice_level === spicePreference ? 0 : 1;
  };

  const regionalFiltered = regionalRecipes.filter(dietVratFilter);
  const globalFiltered = recipes.filter(dietVratFilter).sort((a, b) => spiceScore(a) - spiceScore(b));
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
    { icon: 'camera', title: 'Fridge Scan', subtitle: 'Photo lo → recipe pao', bg: 'var(--tile-1)', onClick: () => router.push('/fridge') },
    { icon: 'chat', title: 'Chef Arti', subtitle: 'Koi bhi sawaal poochho', bg: 'var(--tile-2)', onClick: () => router.push('/chat') },
    { icon: 'pot', title: 'Bacha Hua', subtitle: 'Leftovers → naya dish', bg: 'var(--tile-3)', onClick: () => router.push('/bacha-hua') },
    { icon: 'thali', title: 'Aaj ki Thali', subtitle: 'Teen waqt ka plan', bg: 'var(--tile-4)', onClick: () => router.push('/aaj-ki-thali') },
  ];

  return (
    <PullToRefresh onRefresh={() => router.refresh()}>
      <div data-vrat={isVrat ? 'on' : 'off'} style={{ background: 'var(--cream)', minHeight: '100%', paddingBottom: 88 }}>
        {/* Sticky editorial header */}
        <header
          className="sticky top-0 z-10"
          style={{ background: 'var(--cream)', padding: '10px 18px 12px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 10 }}>
            <div>
              <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Chief-AI-Arti</div>
              <div className="t-ital" style={{ fontSize: 17, color: 'var(--text)' }}>Aaj kya banao?</div>
            </div>
            {isAuthenticated && <VratToggle isVrat={isVrat} onToggle={onVratToggle} loading={vatLoading} />}
          </div>
          <button
            type="button"
            onClick={() => router.push('/search')}
            className="tap-spring"
            style={{ width: '100%', minHeight: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderRadius: 16, background: 'var(--hero-lt)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 14.5 }}
          >
            <Icon name="search" size={19} color="var(--hero-dk)" /> Kuch bhi dhundho…
          </button>
        </header>

        {/* iOS Safari install banner — first visit only */}
        <IOSInstallBanner />

        {/* Greeting card */}
        <section style={{ padding: '16px 18px 0' }}>
          <div className="r-card card-entry stg-1" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--card) 60%, var(--hero-lt) 100%)' }}>
            <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.9 }}><Steam size={30} color="var(--terracotta)" /></div>
            <h1 className="t-display" style={{ fontSize: 26, margin: '0 0 4px', color: 'var(--text)' }}>
              Namaskar{firstName ? `, ${firstName}` : ''}! 🙏
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>{subtitle}</p>
          </div>
        </section>

        {/* Feature grid */}
        <section style={{ padding: '20px 18px 0' }}>
          <SectionHead over="Aaj ka kaam" title="Kya karna hai?" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {featureCards.map((f, i) => (
              <button
                key={f.title}
                type="button"
                onClick={f.onClick}
                className={`tap-spring card-entry stg-${i + 1}`}
                style={{ minHeight: 116, borderRadius: 20, padding: '16px 16px 14px', background: f.bg, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', boxShadow: '0 2px 4px var(--shadow), 0 10px 22px -10px rgba(120,50,10,0.5)' }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={f.icon} size={23} color="#fff" />
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 16.5, fontWeight: 700 }}>{f.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, opacity: 0.92, marginTop: 1 }}>{f.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onSurprise}
            className="tap-spring card-entry stg-5"
            style={{ marginTop: 12, width: '100%', minHeight: 56, borderRadius: 18, border: '1.5px dashed var(--terracotta)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', textAlign: 'left' }}
          >
            <Icon name="dice" size={22} color="var(--terracotta)" />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{surpriseLoading ? 'Dhundh rahe hain…' : 'Surprise karo!'}</span>
              <span className="t-caption">Naya kuch try karein</span>
            </span>
            <Icon name="chevR" size={18} color="var(--muted)" />
          </button>
        </section>

        <div style={{ padding: '20px 18px 0' }}><Divider /></div>

        {/* Aaj ke liye */}
        <section style={{ paddingTop: 14 }}>
          <SectionHead
            over={isVrat ? 'Vrat special' : 'Aaj ke liye'}
            title={isVrat ? 'Phalahari banayein' : 'Aaj yeh banayein'}
            action="Sab dekhein"
            onAction={() => router.push('/search')}
            style={{ padding: '0 18px' }}
          />
          {featured.length === 0 ? (
            <p className="px-4 py-6 text-center" style={{ color: 'var(--muted)', fontSize: 14 }}>Koi recipe nahi mili 😕</p>
          ) : (
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 6px' }}>
              {featured.map((r, i) => (
                <RecipeCardV key={r.id} recipe={r} idx={i} onOpen={(id) => router.push('/recipe/' + id)} />
              ))}
            </div>
          )}
        </section>

        {/* "Banaya tha, toh yeh try karein" — personalized recommendation rows */}
        {recGroups.map((group) => (
          <section key={group.based_on_recipe} style={{ paddingTop: 12 }}>
            <div style={{ padding: '0 18px' }}>
              <SectionHead over="Aapke swaad se" title="Yeh bhi achha lagega" />
              <p className="t-caption" style={{ margin: '4px 0 0' }}>{group.reason}</p>
            </div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 6px' }}>
              {group.recipes.map((r, i) => (
                <RecipeCardV key={r.id} recipe={r} idx={i} onOpen={(id) => router.push('/recipe/' + id)} />
              ))}
            </div>
          </section>
        ))}

        {/* Naye Recipes explore teaser */}
        {showExploreTeaser && (
          <div style={{ padding: '18px 18px 0' }}>
            <button
              type="button"
              onClick={() => router.push('/search')}
              className="tap-spring r-card"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', textAlign: 'left', minHeight: 56 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="search" size={20} color="var(--hero-dk)" />
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>200+ recipes explore karein</span>
                  <span className="t-caption">Poori library dekhein</span>
                </span>
              </span>
              <Icon name="chevR" size={18} color="var(--muted)" />
            </button>
          </div>
        )}

        {/* Floating AI chat — auth-only, general context */}
        {isAuthenticated && <FloatingChatButton subscriptionStatus={subscriptionStatus} />}
      </div>
    </PullToRefresh>
  );
}
