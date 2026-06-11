import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import PendingList, { type PendingCardData } from './PendingList';
import type { Recipe } from '@/types/index';

export const dynamic = 'force-dynamic';

interface PendingRow {
  id: string;
  generated_recipe: Partial<Recipe>;
  requested_by: string;
  cooked_count: number;
  reported_count: number;
  created_at: string;
  users: { name: string | null } | null;
}

export default async function AdminPendingPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data } = await supabase
    .from('recipes_pending')
    .select(
      'id, generated_recipe, requested_by, cooked_count, reported_count, created_at, users:requested_by(name)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const cards: PendingCardData[] = ((data ?? []) as unknown as PendingRow[]).map(
    (row) => ({
      id: row.id,
      name: row.generated_recipe?.name_hinglish ?? '(unnamed)',
      description: row.generated_recipe?.description ?? '',
      ingredients: (row.generated_recipe?.ingredients ?? []).map((i) => i.name),
      steps: (row.generated_recipe?.steps ?? []).map((s) => s.instruction),
      requestedBy: row.users?.name ?? 'Unknown user',
      cookedCount: row.cooked_count,
      reportedCount: row.reported_count,
      createdAt: row.created_at,
    }),
  );

  return <PendingList initialCards={cards} />;
}
