import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Photo uploads are admin-only — see /api/admin/recipes/[id]/photo.

// ─── GET — fetch community photos for a recipe ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('recipe_photos')
    .select('id, s3_url, user_id, caption, created_at')
    .eq('recipe_id', recipeId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[photos] GET error:', error.message);
    return NextResponse.json({ photos: [] });
  }

  return NextResponse.json({ photos: data ?? [] });
}
