import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import HomeClient from './HomeClient';
import { User, Recipe } from '@/types/index';

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single<User>();

  if (!user) redirect('/onboarding');
  if (!user.onboarding_done) redirect('/onboarding');

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .order('cooked_count', { ascending: false })
    .limit(20)
    .returns<Recipe[]>();

  return (
    <main>
      <HomeClient
        initialRecipes={(recipes ?? []) as Recipe[]}
        userName={user.name}
        subscriptionStatus={user.subscription_status}
        initialIsVrat={user.is_vrat_mode}
      />
    </main>
  );
}
