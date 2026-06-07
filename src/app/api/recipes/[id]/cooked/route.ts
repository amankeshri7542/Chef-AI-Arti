import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { User } from '@/types/index';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, family_size')
    .eq('clerk_user_id', userId)
    .single<Pick<User, 'id' | 'family_size'>>();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await supabase.from('cooking_history').insert({
    user_id: user.id,
    recipe_id: recipeId,
    family_size: user.family_size,
    cooked_at: new Date().toISOString(),
  });

  await supabase.rpc('increment_cooked_count', { recipe_id: recipeId }).maybeSingle();

  return NextResponse.json({ ok: true });
}
