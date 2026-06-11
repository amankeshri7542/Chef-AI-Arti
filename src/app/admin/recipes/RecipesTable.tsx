'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface AdminRecipeRow {
  id: string;
  name_hinglish: string;
  category: string;
  diet_type: string;
  cooked_count: number;
  avg_rating: number;
  rating_count: number;
  thumbnail_url: string | null;
}

const CATEGORIES = ['all', 'sabzi', 'dal', 'roti', 'chawal', 'nashta', 'meetha'];
const DIETS = ['all', 'veg', 'non-veg', 'eggetarian'];

export default function RecipesTable({
  initialRecipes,
}: {
  initialRecipes: AdminRecipeRow[];
}) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [diet, setDiet] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recipes.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (diet !== 'all' && r.diet_type !== diet) return false;
      if (q && !r.name_hinglish.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipes, search, category, diet]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/recipes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } else {
      window.alert('Delete failed');
    }
    setDeleting(null);
  }

  const inputStyle = {
    background: '#16213E',
    borderColor: '#0F3460',
    color: '#fff',
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">🍲 Recipes ({recipes.length})</h1>
        <Link
          href="/admin/recipes/new"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: '#E8640C' }}
        >
          ➕ Add New Recipe
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
        <select
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        >
          {DIETS.map((d) => (
            <option key={d} value={d}>
              {d === 'all' ? 'All diets' : d}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ background: '#16213E' }}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#B8B8D0' }}>
              <th className="p-3"></th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Diet</th>
              <th className="p-3 text-right">Cooked</th>
              <th className="p-3 text-right">Rating</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: '#1A1A2E' }}>
                <td className="p-3">
                  {r.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbnail_url}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                      style={{ background: '#1A1A2E' }}
                    >
                      🍲
                    </div>
                  )}
                </td>
                <td className="p-3 font-medium">{r.name_hinglish}</td>
                <td className="p-3" style={{ color: '#B8B8D0' }}>{r.category}</td>
                <td className="p-3" style={{ color: '#B8B8D0' }}>{r.diet_type}</td>
                <td className="p-3 text-right">{r.cooked_count}</td>
                <td className="p-3 text-right">
                  {r.rating_count > 0 ? `⭐ ${Number(r.avg_rating).toFixed(1)}` : '—'}
                </td>
                <td className="p-3 text-right">
                  <Link
                    href={`/admin/recipes/${r.id}/edit`}
                    className="mr-3 font-medium"
                    style={{ color: '#E8640C' }}
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(r.id, r.name_hinglish)}
                    disabled={deleting === r.id}
                    className="font-medium text-red-400 disabled:opacity-50"
                  >
                    {deleting === r.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center" style={{ color: '#B8B8D0' }}>
                  No recipes match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
