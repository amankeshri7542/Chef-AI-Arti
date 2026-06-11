import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

interface ActivityRow {
  cooked_at: string;
  recipes: { name_hinglish: string } | null;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = createServerClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: totalRecipes },
    { count: paidUsers },
    { count: cooksToday },
    { data: topRecipes },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayIso),
    supabase.from('recipes').select('id', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'paid'),
    supabase
      .from('cooking_history')
      .select('id', { count: 'exact', head: true })
      .gte('cooked_at', todayIso),
    supabase
      .from('recipes')
      .select('id, name_hinglish, category, cooked_count')
      .order('cooked_count', { ascending: false })
      .limit(5),
    supabase
      .from('cooking_history')
      .select('cooked_at, recipes(name_hinglish)')
      .order('cooked_at', { ascending: false })
      .limit(10),
  ]);

  const stats = [
    { label: 'Total Users', value: totalUsers ?? 0 },
    { label: 'New Users Today', value: newUsersToday ?? 0 },
    { label: 'Total Recipes', value: totalRecipes ?? 0 },
    { label: 'Paid Subscribers', value: paidUsers ?? 0 },
    { label: 'Cooks Today', value: cooksToday ?? 0 },
    { label: 'Chat Messages Today', value: '—', note: 'Redis-only (not tracked in DB)' },
  ];

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">📊 Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: '#16213E' }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: '#B8B8D0' }}>
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-bold" style={{ color: '#E8640C' }}>
              {s.value}
            </p>
            {s.note && (
              <p className="mt-1 text-[10px]" style={{ color: '#6C6C8A' }}>
                {s.note}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
          <h2 className="mb-3 font-semibold">🏆 Top 5 Cooked Recipes</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: '#B8B8D0' }}>
                <th className="pb-2">Recipe</th>
                <th className="pb-2">Category</th>
                <th className="pb-2 text-right">Cooks</th>
              </tr>
            </thead>
            <tbody>
              {(topRecipes ?? []).map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: '#1A1A2E' }}>
                  <td className="py-2">{r.name_hinglish}</td>
                  <td className="py-2" style={{ color: '#B8B8D0' }}>{r.category}</td>
                  <td className="py-2 text-right font-semibold">{r.cooked_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl p-4" style={{ background: '#16213E' }}>
          <h2 className="mb-3 font-semibold">🕐 Recent Activity</h2>
          <ul className="space-y-2 text-sm">
            {((recentActivity ?? []) as unknown as ActivityRow[]).map((a, i) => (
              <li
                key={i}
                className="flex justify-between border-t pt-2 first:border-0 first:pt-0"
                style={{ borderColor: '#1A1A2E' }}
              >
                <span>🍳 {a.recipes?.name_hinglish ?? 'Unknown recipe'}</span>
                <span style={{ color: '#B8B8D0' }}>{timeAgo(a.cooked_at)}</span>
              </li>
            ))}
            {(recentActivity ?? []).length === 0 && (
              <li style={{ color: '#B8B8D0' }}>No cooking activity yet</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
