import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { User } from '@/types/index';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Check if user already exists
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ user: existing as User, isNew: false });
  }

  // New user — fetch name/phone from Clerk
  const clerkUser = await currentUser();
  const rawName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
  const name = clerkUser?.fullName ?? (rawName || null);
  const phone = clerkUser?.phoneNumbers?.[0]?.phoneNumber ?? null;

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({
      clerk_user_id: userId,
      name,
      phone,
      diet_type: 'veg',
      restrictions: [],
      family_size: 4,
      preferred_unit: 'desi',
      is_vrat_mode: false,
      subscription_status: 'free',
      onboarding_done: false,
      spice_preference: 'medium',
      disliked_ingredients: [],
      preferred_region: null,
    })
    .select('*')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ user: created as User, isNew: true }, { status: 201 });
}
