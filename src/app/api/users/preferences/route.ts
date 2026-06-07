import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { UnitPreference } from '@/types/index';

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Parse body
  const body = await req.json() as { preferred_unit?: UnitPreference };
  const { preferred_unit } = body;

  if (!preferred_unit || !['desi', 'metric'].includes(preferred_unit)) {
    return NextResponse.json({ error: 'Invalid preferred_unit' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 3. Update user
  const { error } = await supabase
    .from('users')
    .update({ preferred_unit })
    .eq('clerk_user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
