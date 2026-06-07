import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST() {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  // 2. Get current vrat mode
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('is_vrat_mode')
    .eq('clerk_user_id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3. Toggle
  const newValue = !user.is_vrat_mode;

  const { error: updateErr } = await supabase
    .from('users')
    .update({ is_vrat_mode: newValue })
    .eq('clerk_user_id', userId);

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ is_vrat_mode: newValue });
}
