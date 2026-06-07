import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import ProfileClient from './ProfileClient';
import type { User } from '@/types/index';

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Get Clerk user for display name
  const clerkUser = await currentUser();

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('subscription_status, subscription_ends_at, diet_type, family_size, preferred_unit')
    .eq('clerk_user_id', userId)
    .single<Pick<User, 'subscription_status' | 'subscription_ends_at' | 'diet_type' | 'family_size' | 'preferred_unit'>>();

  // Fallback defaults if user row not found
  const name = clerkUser?.fullName ?? clerkUser?.firstName ?? null;

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center border-b border-[#E8DDD0] bg-white px-4">
        <p className="text-[16px] font-bold text-[#1A1A1A]">Aapka Profile 👤</p>
      </div>

      <ProfileClient
        name={name}
        subscriptionStatus={user?.subscription_status ?? 'free'}
        subscriptionEndsAt={user?.subscription_ends_at ?? null}
        dietType={user?.diet_type ?? 'veg'}
        familySize={user?.family_size ?? 4}
        preferredUnit={user?.preferred_unit ?? 'desi'}
      />
    </div>
  );
}
