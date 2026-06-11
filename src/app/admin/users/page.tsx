import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import UsersTable, { type AdminUserRow } from './UsersTable';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const [{ data: users }, { data: cooks }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, diet_type, subscription_status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('cooking_history')
      .select('user_id, cooked_at')
      .order('cooked_at', { ascending: false })
      .limit(2000),
  ]);

  // Most recent cook per user (rows already sorted desc — first hit wins).
  const lastCooked = new Map<string, string>();
  for (const c of cooks ?? []) {
    if (!lastCooked.has(c.user_id)) lastCooked.set(c.user_id, c.cooked_at);
  }

  const rows: AdminUserRow[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    diet_type: u.diet_type,
    subscription_status: u.subscription_status,
    created_at: u.created_at,
    last_cooked_at: lastCooked.get(u.id) ?? null,
  }));

  return <UsersTable initialUsers={rows} />;
}
