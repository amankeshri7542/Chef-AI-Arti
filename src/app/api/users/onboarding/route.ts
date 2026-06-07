import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { DietType } from '@/types/index';

interface OnboardingBody {
  diet_type: DietType;
  restrictions: string[];
  family_size: number;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: OnboardingBody = await request.json();
  const { diet_type, restrictions, family_size } = body;

  if (!diet_type || !['veg', 'non-veg', 'eggetarian'].includes(diet_type)) {
    return NextResponse.json({ error: 'Invalid diet_type' }, { status: 400 });
  }
  if (typeof family_size !== 'number' || family_size < 1 || family_size > 20) {
    return NextResponse.json({ error: 'Invalid family_size' }, { status: 400 });
  }

  const supabase = createServerClient();

  // upsert so this is idempotent even if the user row was never created
  const { error } = await supabase
    .from('users')
    .upsert(
      {
        clerk_user_id: userId,
        diet_type,
        restrictions: restrictions ?? [],
        family_size,
        onboarding_done: true,
      },
      { onConflict: 'clerk_user_id', ignoreDuplicates: false },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
