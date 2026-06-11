import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recentCooks }, { count: totalCooks }, { count: totalRatings }] =
    await Promise.all([
      supabase
        .from('cooking_history')
        .select('user_id')
        .gte('cooked_at', sevenDaysAgo)
        .limit(2000),
      supabase.from('cooking_history').select('id', { count: 'exact', head: true }),
      supabase.from('recipe_ratings').select('id', { count: 'exact', head: true }),
    ]);

  const dau7 = new Set((recentCooks ?? []).map((c) => c.user_id)).size;

  const stats = [
    { label: 'Active Cooks (last 7 days)', value: dau7 },
    { label: 'Total Cooks (all time)', value: totalCooks ?? 0 },
    { label: 'Total Ratings', value: totalRatings ?? 0 },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold">📈 Analytics</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: '#16213E' }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: '#B8B8D0' }}>
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-bold" style={{ color: '#E8640C' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{ background: '#16213E' }}>
        <h2 className="mb-2 font-semibold">🦔 PostHog</h2>
        <p className="mb-4 text-sm" style={{ color: '#B8B8D0' }}>
          PostHog dashboards can&apos;t be embedded here (iframes are blocked for
          app dashboards). Full funnels, retention and session replays live in
          the PostHog app.
        </p>
        <a
          href="https://app.posthog.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg px-5 py-3 font-semibold text-white"
          style={{ background: '#E8640C' }}
        >
          View full analytics in PostHog →
        </a>
      </div>
    </div>
  );
}
