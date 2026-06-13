'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/lib/toast';
import RecipeCardCompact from '@/components/RecipeCard/RecipeCardCompact';
import CollectionCard from '@/components/CollectionCard/CollectionCard';
import BackButton from '@/components/BackButton/BackButton';
import RecipeGridSkeleton from '@/components/Skeletons/RecipeGridSkeleton';
import PullToRefresh from '@/components/PullToRefresh/PullToRefresh';
import { RECIPE_COLLECTIONS } from '@/lib/collections';
import { Recipe } from '@/types/index';

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
 * This prevents typo'd queries ("Malasa Dosa") from reaching YouTube as-is.
 */
function normalizeYouTubeQuery(raw: string, recipeNames: string[]): string {
  if (!raw.trim() || recipeNames.length === 0) return raw;
  let best = raw;
  let bestSim = 0.45; // minimum threshold — below this, use raw query
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
  { label: '🥗 Sabzi', query: 'sabzi' },
  { label: '🫘 Dal', query: 'dal' },
  { label: '🍚 Chawal', query: 'chawal' },
  { label: '🍳 Nashta', query: 'nashta' },
  { label: '🫓 Roti', query: 'roti' },
  { label: '🍬 Meetha', query: 'meetha' },
  { label: '🕉️ Vrat', query: 'vrat' },
];

type ActiveSource =
  | { type: 'none' }
  | { type: 'search'; term: string }
  | { type: 'chip'; label: string; query: string }
  | { type: 'collection'; id: string; label: string; emoji: string };

/** Fast SQL-only browse — no embedding / vector search. */
async function fetchBrowse(filter: Record<string, unknown>): Promise<Recipe[]> {
  const params = new URLSearchParams();
  if (filter.category)         params.set('category', String(filter.category));
  if (filter.tag)              params.set('tag',      String(filter.tag));
  if (filter.is_vrat_friendly) params.set('vrat',     'true');
  if (filter.vibe)             params.set('vibe',     String(filter.vibe));
  if (filter.limit)            params.set('limit',    String(filter.limit));

  const res = await fetch(`/api/recipes/browse?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.recipes ?? [];
}

/** RAG search — uses embedding + vector similarity. Only for text queries. */
async function fetchSearch(
  query: string,
): Promise<{ recipes: Recipe[]; miss: boolean }> {
  const params = new URLSearchParams();
  params.set('q', query);
  const res = await fetch(`/api/recipes/search?${params.toString()}`);
  if (!res.ok) return { recipes: [], miss: true };
  const data = await res.json();
  // A fallback result is the top-popular list dressed up as a match — treat it
  // as "nothing found" so the UI shows the generate CTA, not random recipes.
  const miss = !!(data.isEmptyStateFallback || data.triggerCase2);
  return { recipes: miss ? [] : data.recipes ?? [], miss };
}

function GenerateButtons({
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
  return isSignedIn ? (
    <button
      type="button"
      disabled={generating}
      onClick={onGenerate}
      className="tap-spring flex items-center gap-2 rounded-xl bg-[#BF4E06] px-6 py-3 text-white font-medium disabled:opacity-60"
      style={{ fontSize: 14, minHeight: 48 }}
    >
      {generating ? '✨ Arti bana rahi hai...' : '🎬 YouTube se dhundho aur banao'}
    </button>
  ) : (
    <button
      type="button"
      onClick={onLogin}
      className="tap-spring rounded-xl border border-[#BF4E06] px-6 py-3 text-[#BF4E06] font-medium"
      style={{ fontSize: 14, minHeight: 48 }}
    >
      Login karke try karein →
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
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, []);

  const runSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setActiveSource({ type: 'search', term: searchTerm });
    try {
      // Raw query — the API does direct name/tag match first, then translates
      // ingredient words to Hinglish only for the vector-search fallback.
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
      // Reset to top recipes when cleared
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
    // Chips use browse API (category filter) not vector search
    const chipFilter: Record<string, unknown> = { limit: 24 };
    // Map chip queries to browse params
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

  const handleClear = () => {
    setQuery('');
  };

  const handleGenerateRecipe = async (searchQuery: string) => {
    if (generating) return;
    setGenerating(true);
    // Normalize potentially typo'd query against known recipe names so YouTube
    // gets a canonical dish name ("Masala Dosa") not a typo ("Malasa Dosa").
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

  // Key for the results grid — changes with query/filter so cards re-animate
  const gridKey: string = (() => {
    if (activeSource.type === 'search') return `search:${activeSource.term}`;
    if (activeSource.type === 'chip') return `chip:${activeSource.query}`;
    if (activeSource.type === 'collection') return `col:${activeSource.id}`;
    return 'browse';
  })();

  const resultsHeading: string | null = (() => {
    if (activeSource.type === 'search') return `"${activeSource.term}" ke results`;
    if (activeSource.type === 'chip') return `${activeSource.label} recipes`;
    if (activeSource.type === 'collection') return `${activeSource.emoji} ${activeSource.label}`;
    return '🔥 Popular Recipes';
  })();

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col min-h-full bg-[#FFFAF6]">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 bg-white px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid #E8DDD0' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BackButton fallback="/home" className="bg-[#FFF0E6] text-[#5C3D1E]" />
          <div>
            <p className="font-bold text-[#1A1A1A]" style={{ fontSize: 16 }}>
              🔍 Recipe Dhundho
            </p>
            <p className="text-[#806244]" style={{ fontSize: 12 }}>
              Kuch bhi likho — aloo, dal, biryani...
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#806244] text-sm select-none">
            🔍
          </span>
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
            placeholder="Aloo gobhi, moong dal..."
            className="w-full rounded-full px-4 pl-9 pr-12 py-3 text-sm text-[#1A1A1A] outline-none"
            style={{
              background: '#FFF0E6',
              border: '1px solid #E8DDD0',
              fontSize: 14,
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#806244] text-sm leading-none"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mt-2">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = activeSource.type === 'chip' && activeSource.query === chip.query;
            return (
              <button
                key={chip.query}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="tap-spring flex-shrink-0 rounded-full font-medium"
                style={{
                  background: isActive ? 'var(--saffron-dk)' : '#FFFFFF',
                  border: isActive ? '1px solid var(--saffron-dk)' : '1px solid var(--border)',
                  color: isActive ? '#fff' : 'var(--text)',
                  fontSize: 14,
                  padding: '12px 16px',
                  minHeight: 48,
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 200ms ease',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3">
        {/* Food Library */}
        {activeSource.type !== 'search' && (
          <div className="mb-6">
            <p className="font-semibold text-[#1A1A1A] mb-3" style={{ fontSize: 15 }}>
              📚 Food Library
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {RECIPE_COLLECTIONS.map((col) => (
                <CollectionCard
                  key={col.id}
                  collection={col}
                  active={activeCollectionId === col.id}
                  onClick={() => handleCollectionClick(col)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results heading + count. Default browse loads only a slice of the
            library, so showing its count ("24 recipes") falsely implies that's
            all there is — drop the count there; show it only for real searches. */}
        {resultsHeading && !loading && (
          <p className="text-[#806244] mb-3" style={{ fontSize: 13 }}>
            {resultsHeading}
            {results.length > 0 && activeSource.type !== 'none' &&
              ` — ${results.length} recipes mili`}
          </p>
        )}

        {/* Loading — content-shaped skeleton so it never feels slow */}
        {loading && <RecipeGridSkeleton className="pb-24" />}

        {/* Recipe grid — keyed by active source so it re-animates on filter change */}
        {!loading && results.length > 0 && (
          <div key={gridKey} className="grid grid-cols-2 gap-3.5 pb-24">
            {results.map((recipe, i) => (
              <div
                key={recipe.id}
                className="card-entry"
                style={{ animationDelay: `${Math.min(i, 11) * 60}ms` }}
              >
                <RecipeCardCompact
                  recipe={recipe}
                  saved={savedIds.has(recipe.id)}
                  onClick={() => router.push(`/recipe/${recipe.id}`)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state — search miss offers AI generation */}
        {!loading && results.length === 0 && activeSource.type === 'search' && (
          <div className="animate-fade-in-up flex flex-col items-center gap-4 py-8 text-center px-4">
            <span className="text-4xl">🔍</span>
            <p className="font-semibold text-[#2C1810]" style={{ fontSize: 14 }}>
              &quot;{activeSource.term}&quot; ke liye koi recipe nahi mili
            </p>
            <p className="text-[#806244]" style={{ fontSize: 13 }}>
              Kya Arti aapke liye yeh recipe banaye?
            </p>
            <GenerateButtons
              isSignedIn={!!isSignedIn}
              generating={generating}
              onGenerate={() => handleGenerateRecipe(activeSource.term)}
              onLogin={() => router.push('/sign-in')}
            />
          </div>
        )}

        {/* Below search results — vector search always returns *something*,
            so the generate CTA must also show alongside weak matches */}
        {!loading && results.length > 0 && activeSource.type === 'search' && (
          <div className="mb-24 -mt-16 flex flex-col items-center gap-3 rounded-2xl border border-[#E8D5C0] bg-[#FFF8F0] px-4 py-5 text-center">
            <p className="font-semibold text-[#2C1810]" style={{ fontSize: 13 }}>
              Jo dhundh rahe the woh nahi mila? 🤔
            </p>
            <p className="text-[#806244]" style={{ fontSize: 13 }}>
              Arti &quot;{activeSource.term}&quot; ki recipe YouTube se dhundh ke bana sakti hai
            </p>
            <GenerateButtons
              isSignedIn={!!isSignedIn}
              generating={generating}
              onGenerate={() => handleGenerateRecipe(activeSource.term)}
              onLogin={() => router.push('/sign-in')}
            />
          </div>
        )}

        {/* Empty state — chip/collection filters with no recipes */}
        {!loading && results.length === 0 && (activeSource.type === 'chip' || activeSource.type === 'collection') && (
          <div className="animate-fade-in-up flex flex-col items-center justify-center py-16 text-center gap-3">
            <p className="text-4xl">🍲</p>
            <p className="font-semibold text-[#1A1A1A]" style={{ fontSize: 15 }}>
              Arre, yeh recipe abhi nahi mili!
            </p>
            <p className="text-[#806244]" style={{ fontSize: 13 }}>
              Koi baat nahi — kuch aur likh ke dekho, ya fridge ki photo se recipe banwao 🥕
            </p>
            <button
              type="button"
              onClick={() => router.push('/fridge')}
              className="tap-spring mt-2 px-6 py-3 rounded-full font-semibold text-white"
              style={{ background: 'var(--saffron-dk)', fontSize: 14, minHeight: 52 }}
            >
              📷 Fridge Scan karo
            </button>
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
