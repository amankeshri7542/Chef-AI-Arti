'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import RecipeCardCompact from '@/components/RecipeCard/RecipeCardCompact';
import CollectionCard from '@/components/CollectionCard/CollectionCard';
import BackButton from '@/components/BackButton/BackButton';
import { RECIPE_COLLECTIONS } from '@/lib/collections';
import { Recipe } from '@/types/index';

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

async function fetchByFilter(filter: Record<string, unknown>): Promise<Recipe[]> {
  const res = await fetch('/api/recipes/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filter),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recipes ?? [];
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<ActiveSource>({ type: 'none' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default: load top recipes on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchByFilter({ orderBy: 'cooked_count', limit: 20 }).then((recipes) => {
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
      const data = await fetchByFilter({ query: searchTerm });
      setResults(data);
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
        fetchByFilter({ orderBy: 'cooked_count', limit: 20 }).then((recipes) => {
          setResults(recipes);
          setLoading(false);
        });
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, runSearch]);

  const handleChipClick = (chip: { label: string; query: string }) => {
    setQuery('');
    setLoading(true);
    setActiveSource({ type: 'chip', label: chip.label, query: chip.query });
    fetchByFilter({ query: chip.query }).then((recipes) => {
      setResults(recipes);
      setLoading(false);
    });
  };

  const handleCollectionClick = (collection: (typeof RECIPE_COLLECTIONS)[number]) => {
    setQuery('');
    setLoading(true);
    setActiveSource({ type: 'collection', id: collection.id, label: collection.label, emoji: collection.emoji });
    fetchByFilter({ ...collection.filter }).then((recipes) => {
      setResults(recipes);
      setLoading(false);
    });
  };

  const handleClear = () => {
    setQuery('');
  };

  const activeCollectionId = activeSource.type === 'collection' ? activeSource.id : null;

  const resultsHeading: string | null = (() => {
    if (activeSource.type === 'search') return `"${activeSource.term}" ke results`;
    if (activeSource.type === 'chip') return `${activeSource.label} recipes`;
    if (activeSource.type === 'collection') return `${activeSource.emoji} ${activeSource.label}`;
    return null;
  })();

  return (
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
            <p className="text-[#8B7355]" style={{ fontSize: 11 }}>
              Kuch bhi likho — aloo, dal, biryani...
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355] text-sm select-none">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Aloo gobhi, moong dal..."
            className="w-full rounded-full px-4 pl-9 py-2.5 text-sm text-[#1A1A1A] outline-none"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355] text-sm leading-none"
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
                className="flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: isActive ? '#E8640C' : '#FFF0E6',
                  border: '1px solid #E8DDD0',
                  color: isActive ? '#fff' : '#5C3D1E',
                  fontSize: 12,
                  minHeight: 32,
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
          <div className="mb-4">
            <p className="font-semibold text-[#1A1A1A] mb-3" style={{ fontSize: 13 }}>
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

        {/* Results heading */}
        {resultsHeading && !loading && (
          <p className="text-[#8B7355] mb-3" style={{ fontSize: 12 }}>
            {resultsHeading}
            {results.length > 0 && ` — ${results.length} recipes`}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E8640C] border-t-transparent" />
            <p className="text-[#8B7355]" style={{ fontSize: 12 }}>Dhundh rahi hoon...</p>
          </div>
        )}

        {/* Recipe grid */}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {results.map((recipe) => (
              <RecipeCardCompact
                key={recipe.id}
                recipe={recipe}
                onClick={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && activeSource.type !== 'none' && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <p className="text-3xl">😕</p>
            <p className="font-semibold text-[#1A1A1A]" style={{ fontSize: 15 }}>
              Koi recipe nahi mili
            </p>
            <p className="text-[#8B7355]" style={{ fontSize: 13 }}>
              Kuch aur try karein ya fridge scan karein
            </p>
            <button
              type="button"
              onClick={() => router.push('/fridge')}
              className="mt-2 px-5 py-2.5 rounded-full font-semibold text-white"
              style={{ background: '#E07B39', fontSize: 14, minHeight: 44 }}
            >
              📷 Fridge Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
