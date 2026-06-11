import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import PhotosGrid, { type AdminPhotoRow } from './PhotosGrid';

export const dynamic = 'force-dynamic';

interface PhotoRowRaw {
  id: string;
  s3_url: string;
  created_at: string;
  recipes: { name_hinglish: string } | null;
}

export default async function AdminPhotosPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const [{ data }, { data: recipeRows }] = await Promise.all([
    supabase
      .from('recipe_photos')
      .select('id, s3_url, created_at, recipes(name_hinglish)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('recipes')
      .select('id, name_hinglish')
      .order('name_hinglish', { ascending: true }),
  ]);

  const photos: AdminPhotoRow[] = ((data ?? []) as unknown as PhotoRowRaw[]).map(
    (p) => ({
      id: p.id,
      s3_url: p.s3_url,
      created_at: p.created_at,
      recipe_name: p.recipes?.name_hinglish ?? 'Unknown recipe',
    }),
  );

  return (
    <PhotosGrid
      initialPhotos={photos}
      recipes={(recipeRows ?? []) as { id: string; name_hinglish: string }[]}
    />
  );
}
