import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { User, Recipe } from '@/types/index';
import RecipeDetailClient from './RecipeDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();

  const [{ data: user }, { data: recipe }] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single<User>(),
    supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single<Recipe>(),
  ]);

  if (!user) redirect('/onboarding');
  if (!user.onboarding_done) redirect('/onboarding');
  if (!recipe) notFound();

  return (
    <RecipeDetailClient
      recipe={recipe}
      familySize={user.family_size}
      unitPreference={user.preferred_unit}
      subscriptionStatus={user.subscription_status}
    />
  );
}
