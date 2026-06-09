import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET — check if recipe is saved by user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ saved: false });

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { data } = await supabase
    .from('recipe_saves')
    .select('id')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .maybeSingle();

  return NextResponse.json({ saved: !!data });
}

// POST — save recipe
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from('recipe_saves')
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: 'user_id,recipe_id' });

  if (error) {
    console.error('[save] insert error:', error.message);
    return NextResponse.json({ error: 'Save nahi hua' }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}

// DELETE — unsave recipe
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  await supabase
    .from('recipe_saves')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId);

  return NextResponse.json({ saved: false });
}
