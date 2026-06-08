import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import HomeClient from './HomeClient';
import { User, Recipe } from '@/types/index';

export default async function HomePage() {
  const { userId } = await auth();

  const supabase = createServerClient();

  // Always fetch recipes (public)
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('source', 'curated')
    .order('cooked_count', { ascending: false })
    .limit(20)
    .returns<Recipe[]>();

  // Fetch user only if logged in; redirect to onboarding if not set up
  let user: User | null = null;
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single<User>();
    user = data;
  }

  return (
    <main>
      <HomeClient
        initialRecipes={(recipes ?? []) as Recipe[]}
        userName={user?.name ?? null}
        subscriptionStatus={user?.subscription_status ?? 'free'}
        initialIsVrat={user?.is_vrat_mode ?? false}
        isAuthenticated={!!userId}
      />
    </main>
  );
}
