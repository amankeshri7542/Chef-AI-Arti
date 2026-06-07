import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

// Called by sso-callback after Google OAuth completes.
// Creates the Supabase user row on first login, then routes to /onboarding or /home.
export async function GET() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();

  // Check if user row already exists
  const { data: existing } = await supabase
    .from('users')
    .select('onboarding_done')
    .eq('clerk_user_id', userId)
    .single();

  if (existing) {
    redirect(existing.onboarding_done ? '/home' : '/onboarding');
  }

  // First login — create the Supabase row
  const clerkUser = await currentUser();
  const rawName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
  const name = clerkUser?.fullName ?? (rawName || null);

  await supabase.from('users').insert({
    clerk_user_id: userId,
    name,
    phone: clerkUser?.phoneNumbers?.[0]?.phoneNumber ?? null,
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
  });

  redirect('/onboarding');
}
