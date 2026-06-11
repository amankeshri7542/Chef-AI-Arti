import { requireAdmin } from '@/lib/admin-auth';
import RecipeForm from '../RecipeForm';

export const dynamic = 'force-dynamic';

export default async function NewRecipePage() {
  await requireAdmin();
  return <RecipeForm />;
}
