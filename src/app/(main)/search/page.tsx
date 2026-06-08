'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import RecipeCardGrid from '@/components/RecipeCard/RecipeCardGrid';
import RecipeCardSkeleton from '@/components/Skeletons/RecipeCardSkeleton';
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

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/recipes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.recipes ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearched(false);
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleChipClick = (chipQuery: string) => {
    setQuery(chipQuery);
    runSearch(chipQuery);
    setSearched(true);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#FFFAF6]">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 bg-white px-4 pt-4 pb-2"
        style={{ borderBottom: '1px solid #E8DDD0' }}
      >
        <p className="font-bold text-[#1A1A1A]" style={{ fontSize: 16 }}>
          🔍 Recipe Dhundho
        </p>
        <p className="text-[#8B7355] mt-0.5" style={{ fontSize: 11 }}>
          Kuch bhi likho — aloo, dal, biryani...
        </p>

        {/* Search input */}
        <div className="relative mt-3 mb-1">
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
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3">
        {/* Initial state — category chips */}
        {!searched && !loading && (
          <div>
            <p className="text-[#8B7355] mb-3" style={{ fontSize: 12 }}>
              Category se dhundho:
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CHIPS.map((chip) => (
                <button
                  key={chip.query}
                  type="button"
                  onClick={() => handleChipClick(chip.query)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    background: '#FFF0E6',
                    border: '1px solid #E8DDD0',
                    color: '#5C3D1E',
                    fontSize: 13,
                    minHeight: 36,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col gap-3">
            <RecipeCardSkeleton />
            <RecipeCardSkeleton />
            <RecipeCardSkeleton />
          </div>
        )}

        {/* Results */}
        {!loading && searched && results.length > 0 && (
          <div className="grid grid-cols-2 gap-0.5">
            {results.map((recipe, index) => {
              const isFeatured = index % 5 === 4;
              return (
                <div key={recipe.id} className={isFeatured ? 'col-span-2' : ''} style={isFeatured ? { aspectRatio: '2/1' } : {}}>
                  <RecipeCardGrid
                    recipe={recipe}
                    onClick={() => router.push(`/recipe/${recipe.id}`)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && (
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
