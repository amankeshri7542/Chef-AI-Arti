import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  // 2. Get subscription info
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status, subscription_ends_at')
    .eq('clerk_user_id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: user.subscription_status,
    ends_at: user.subscription_ends_at,
    isPaid: user.subscription_status === 'paid',
  });
}
