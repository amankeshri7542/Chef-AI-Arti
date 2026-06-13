'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/lib/toast';
import CollectionCard from '@/components/CollectionCard/CollectionCard';
import BackButton from '@/components/BackButton/BackButton';
import RecipeGridSkeleton from '@/components/Skeletons/RecipeGridSkeleton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';
import { RECIPE_COLLECTIONS } from '@/lib/collections';
import { Recipe } from '@/types/index';
import Icon from '@/components/editorial/Icon';
import { SectionHead } from '@/components/editorial/SectionHead';
import { GridCard } from '@/components/editorial/RecipeCards';

/** Lightweight Dice/bigram similarity for YouTube query normalization. */
function bigramSim(a: string, b: string): number {
  const bigrams = (s: string) => {
    const lc = s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, '');
    const set = new Set<string>();
    for (let i = 0; i < lc.length - 1; i++) set.add(lc.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size + bb.size === 0) return 0;
  let n = 0;
  for (const g of ba) if (bb.has(g)) n++;
  return (2 * n) / (ba.size + bb.size);
}

/**
 * Given a raw (possibly typo'd) query and a list of recipe names, return the
 * canonical name if similarity exceeds threshold, else the raw query.
 */
function normalizeYouTubeQuery(raw: string, recipeNames: string[]): string {
  if (!raw.trim() || recipeNames.length === 0) return raw;
  let best = raw;
  let bestSim = 0.45;
  for (const name of recipeNames) {
    const s = bigramSim(raw, name);
    if (s > bestSim) {
      bestSim = s;
      best = name;
    }
  }
  return best;
}

const CATEGORY_CHIPS = [
  { label: 'Sabzi', query: 'sabzi' },
  { label: 'Dal', query: 'dal' },
  { label: 'Chawal', query: 'chawal' },
  { label: 'Nashta', query: 'nashta' },
  { label: 'Roti', query: 'roti' },
  { label: 'Meetha', query: 'meetha' },
  { label: 'Vrat', query: 'vrat' },
];

type ActiveSource =
  | { type: 'none' }
  | { type: 'search'; term: string }
  | { type: 'chip'; label: string; query: string }
  | { type: 'collection'; id: string; label: string; emoji: string };

/** Fast SQL-only browse — no embedding / vector search. */
async function fetchBrowse(filter: Record<string, unknown>): Promise<Recipe[]> {
  const params = new URLSearchParams();
  if (filter.category) params.set('category', String(filter.category));
  if (filter.tag) params.set('tag', String(filter.tag));
  if (filter.is_vrat_friendly) params.set('vrat', 'true');
  if (filter.vibe) params.set('vibe', String(filter.vibe));
  if (filter.limit) params.set('limit', String(filter.limit));

  const res = await fetch(`/api/recipes/browse?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.recipes ?? [];
}

/** RAG search — uses embedding + vector similarity. Only for text queries. */
async function fetchSearch(query: string): Promise<{ recipes: Recipe[]; miss: boolean }> {
  const params = new URLSearchParams();
  params.set('q', query);
  const res = await fetch(`/api/recipes/search?${params.toString()}`);
  if (!res.ok) return { recipes: [], miss: true };
  const data = await res.json();
  const miss = !!(data.isEmptyStateFallback || data.triggerCase2);
  return { recipes: miss ? [] : data.recipes ?? [], miss };
}

/** Editorial generate CTA — "Arti se banwao" (signed-in) or login nudge. */
function GenerateButton({
  isSignedIn,
  generating,
  onGenerate,
  onLogin,
}: {
  isSignedIn: boolean;
  generating: boolean;
  onGenerate: () => void;
  onLogin: () => void;
}) {
  if (!isSignedIn) {
    return (
      <button type="button" onClick={onLogin} className="r-cta ghost tap-spring">
        Login karke try karein <Icon name="chevR" size={18} color="var(--hero-dk)" />
      </button>
    );
  }
  if (generating) {
    return (
      <div className="r-card" style={{ width: '100%', padding: '22px', textAlign: 'center' }}>
        <span className="pot-stir" style={{ display: 'inline-flex' }}>
          <Icon name="pot" size={40} color="var(--hero)" sw={1.5} />
        </span>
        <p className="t-display" style={{ fontSize: 18, margin: '10px 0 4px', color: 'var(--text)' }}>Arti soch rahi hai…</p>
        <p className="t-caption" style={{ margin: '0 0 12px' }}>Samagri aur vidhi likhi ja rahi hai</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="dot-b" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hero)', animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={onGenerate} className="r-cta tap-spring">
      <Icon name="sparkle" size={20} color="#fff" /> Haan Arti, bana do!
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeSource, setActiveSource] = useState<ActiveSource>({ type: 'none' });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saved recipes — so cards can show a ❤️ for ones the user has saved.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetch('/api/recipes/saved')
      .then((r) => (r.ok ? r.json() : { recipes: [] }))
      .then((d: { recipes?: Recipe[] }) => {
        if (!cancelled) setSavedIds(new Set((d.recipes ?? []).map((r) => r.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Default: load top recipes on mount (fast browse, no vector search)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBrowse({ limit: 24 }).then((recipes) => {
      if (!cancelled) {
        setResults(recipes);
        setLoading(false);
        setActiveSource({ type: 'none' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setActiveSource({ type: 'search', term: searchTerm });
    try {
      const { recipes } = await fetchSearch(searchTerm.trim());
      setResults(recipes);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      if (activeSource.type === 'search') {
        setLoading(true);
        setActiveSource({ type: 'none' });
        fetchBrowse({ limit: 24 }).then((recipes) => {
          setResults(recipes);
          setLoading(false);
        });
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, runSearch]);

  const handleChipClick = (chip: { label: string; query: string }) => {
    setQuery('');
    setLoading(true);
    setActiveSource({ type: 'chip', label: chip.label, query: chip.query });
    const chipFilter: Record<string, unknown> = { limit: 24 };
    if (chip.query === 'vrat') chipFilter.is_vrat_friendly = true;
    else chipFilter.category = chip.query;
    fetchBrowse(chipFilter).then((recipes) => {
      setResults(recipes);
      setLoading(false);
    });
  };

  const handleCollectionClick = (collection: (typeof RECIPE_COLLECTIONS)[number]) => {
    setQuery('');
    setLoading(true);
    setActiveSource({ type: 'collection', id: collection.id, label: collection.label, emoji: collection.emoji });
    fetchBrowse({ ...collection.filter }).then((recipes) => {
      setResults(recipes);
      setLoading(false);
    });
  };

  const handleGenerateRecipe = async (searchQuery: string) => {
    if (generating) return;
    setGenerating(true);
    const knownNames = results.map((r) => r.name_hinglish);
    const normalizedQuery = normalizeYouTubeQuery(searchQuery, knownNames);
    try {
      const res = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: normalizedQuery, ingredients: [normalizedQuery] }),
      });
      if (!res.ok) throw new Error(`generate failed: ${res.status}`);
      const data = await res.json();
      if (!data.pendingId) throw new Error('no pendingId');
      router.push(`/recipe/pending/${data.pendingId}`);
    } catch {
      toast.error('Abhi nahi bana saki, baad mein try karo');
      setGenerating(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setQuery('');
    setLoading(true);
    setActiveSource({ type: 'none' });
    const recipes = await fetchBrowse({ limit: 24 });
    setResults(recipes);
    setLoading(false);
  }, []);

  const activeCollectionId = activeSource.type === 'collection' ? activeSource.id : null;

  const gridKey: string = (() => {
    if (activeSource.type === 'search') return `search:${activeSource.term}`;
    if (activeSource.type === 'chip') return `chip:${activeSource.query}`;
    if (activeSource.type === 'collection') return `col:${activeSource.id}`;
    return 'browse';
  })();

  // Editorial heading: overline + Playfair title.
  const heading: { over: string; title: string } = (() => {
    if (activeSource.type === 'search') {
      return { over: `"${activeSource.term}" ke liye`, title: `${results.length} recipe mili` };
    }
    if (activeSource.type === 'chip') return { over: 'Filter', title: `${activeSource.label} recipes` };
    if (activeSource.type === 'collection') return { over: 'Collection', title: activeSource.label };
    return { over: 'Sab pasand karte hain', title: 'Popular Recipes' };
  })();

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div style={{ background: 'var(--cream)', minHeight: '100%' }}>
        {/* Sticky editorial header */}
        <header className="sticky top-0 z-10" style={{ background: 'var(--cream)', padding: '12px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <BackButton fallback="/home" className="bg-[var(--hero-lt)] text-[var(--hero-dk)]" />
            <div>
              <div className="t-overline" style={{ color: 'var(--hero-dk)' }}>Recipe Dhundho</div>
              <div className="t-ital" style={{ fontSize: 16, color: 'var(--text)' }}>Kuch bhi likho — aloo, dal, biryani…</div>
            </div>
          </div>

          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 50, padding: '0 16px', borderRadius: 16, background: 'var(--hero-lt)', border: '1px solid var(--border)' }}>
            <Icon name="search" size={19} color="var(--hero-dk)" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  runSearch(query);
                }
              }}
              placeholder="Aloo gobhi, moong dal…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: 'var(--text)', minHeight: 48 }}
            />
            {query.length > 0 && (
              <button type="button" aria-label="Saaf karein" onClick={() => setQuery('')} style={{ display: 'flex', width: 32, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color="var(--muted)" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10 }}>
            {CATEGORY_CHIPS.map((chip) => {
              const isActive = activeSource.type === 'chip' && activeSource.query === chip.query;
              return (
                <button key={chip.query} type="button" onClick={() => handleChipClick(chip)} className={`r-chip tap-spring ${isActive ? 'on' : ''}`}>
                  {chip.query === 'vrat' && <Icon name="om" size={15} />}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Body */}
        <div style={{ padding: '14px 18px 0' }}>
          {/* Food Library — only when not searching */}
          {activeSource.type !== 'search' && (
            <section style={{ marginBottom: 18 }}>
              <SectionHead over="Food library" title="Collections" />
              <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 0 4px' }}>
                {RECIPE_COLLECTIONS.map((col) => (
                  <CollectionCard key={col.id} collection={col} active={activeCollectionId === col.id} onClick={() => handleCollectionClick(col)} />
                ))}
              </div>
            </section>
          )}

          {/* Results heading */}
          {!loading && (results.length > 0 || activeSource.type === 'search') && (
            <SectionHead over={heading.over} title={heading.title} />
          )}

          {/* Loading skeleton */}
          {loading && <div style={{ paddingTop: 14 }}><RecipeGridSkeleton className="pb-24" /></div>}

          {/* Recipe grid */}
          {!loading && results.length > 0 && (
            <div key={gridKey} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14, paddingBottom: 24 }}>
              {results.map((recipe, i) => (
                <GridCard key={recipe.id} recipe={recipe} idx={i % 6} saved={savedIds.has(recipe.id)} onOpen={(id) => router.push(`/recipe/${id}`)} />
              ))}
            </div>
          )}

          {/* Empty state — search miss offers AI generation */}
          {!loading && results.length === 0 && activeSource.type === 'search' && (
            <div className="r-card card-entry" style={{ marginTop: 14, padding: '26px 22px', textAlign: 'center', marginBottom: 96 }}>
              {!generating && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--hero-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="pot" size={30} color="var(--hero-dk)" sw={1.6} />
                  </span>
                </div>
              )}
              {!generating && (
                <>
                  <h3 className="t-display" style={{ fontSize: 21, margin: '0 0 6px', color: 'var(--text)' }}>
                    &quot;{activeSource.term}&quot; abhi library mein nahi hai
                  </h3>
                  <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14 }}>
                    Koi baat nahi! Arti aapke liye yeh recipe abhi bana degi — bilkul aapke swaad ke hisaab se. 🎬
                  </p>
                </>
              )}
              <GenerateButton isSignedIn={!!isSignedIn} generating={generating} onGenerate={() => handleGenerateRecipe(activeSource.term)} onLogin={() => router.push('/sign-in')} />
            </div>
          )}

          {/* Below weak search results — also offer generate */}
          {!loading && results.length > 0 && activeSource.type === 'search' && (
            <div className="r-card" style={{ marginBottom: 96, marginTop: 4, padding: '20px 22px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Jo dhundh rahe the woh nahi mila? 🤔</p>
              <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13.5 }}>
                Arti &quot;{activeSource.term}&quot; ki recipe YouTube se dhundh ke bana sakti hai
              </p>
              <GenerateButton isSignedIn={!!isSignedIn} generating={generating} onGenerate={() => handleGenerateRecipe(activeSource.term)} onLogin={() => router.push('/sign-in')} />
            </div>
          )}

          {/* Empty state — chip/collection filters with no recipes */}
          {!loading && results.length === 0 && (activeSource.type === 'chip' || activeSource.type === 'collection') && (
            <div className="card-entry" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '48px 16px' }}>
              <span style={{ fontSize: 38 }}>🍲</span>
              <p className="t-display" style={{ fontSize: 18, margin: 0, color: 'var(--text)' }}>Arre, yeh recipe abhi nahi mili!</p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>Kuch aur likh ke dekho, ya fridge ki photo se recipe banwao 🥕</p>
              <button type="button" onClick={() => router.push('/fridge')} className="r-cta tap-spring" style={{ marginTop: 6, maxWidth: 280 }}>
                <Icon name="camera" size={20} color="#fff" /> Fridge Scan karo
              </button>
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
