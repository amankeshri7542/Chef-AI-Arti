import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import PushForm, { type PushLogRow } from './PushForm';

export const dynamic = 'force-dynamic';

export default async function AdminPushPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: logs } = await supabase
    .from('push_logs')
    .select('id, title, body, target, sent_count, sent_at')
    .order('sent_at', { ascending: false })
    .limit(20);

  return <PushForm initialLogs={(logs ?? []) as PushLogRow[]} />;
}
