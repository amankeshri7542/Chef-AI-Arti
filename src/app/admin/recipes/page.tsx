import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import RecipesTable, { type AdminRecipeRow } from './RecipesTable';

export const dynamic = 'force-dynamic';

export default async function AdminRecipesPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data } = await supabase
    .from('recipes')
    .select(
      'id, name_hinglish, category, diet_type, cooked_count, avg_rating, rating_count, thumbnail_url',
    )
    .order('created_at', { ascending: false });

  return <RecipesTable initialRecipes={(data ?? []) as AdminRecipeRow[]} />;
}
