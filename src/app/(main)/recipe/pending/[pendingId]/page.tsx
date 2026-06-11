import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import type { RecipePending } from '@/types/index';
import type { GeneratedRecipe } from '@/lib/generate-recipe';
import PendingRecipeClient from './PendingRecipeClient';

export default async function PendingRecipePage({
  params,
}: {
  params: Promise<{ pendingId: string }>;
}) {
  const { pendingId } = await params;

  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single<{ id: string }>();

  if (!user) notFound();

  const { data: row } = await supabase
    .from('recipes_pending')
    .select('id, generated_recipe, cooked_count, status, shown_to_user_ids, youtube_video_id')
    .eq('id', pendingId)
    .single<
      Pick<
        RecipePending,
        'id' | 'generated_recipe' | 'cooked_count' | 'status' | 'shown_to_user_ids' | 'youtube_video_id'
      >
    >();

  // Pending recipes are private to the users they've been shown to.
  if (!row || !(row.shown_to_user_ids ?? []).includes(user.id)) {
    notFound();
  }

  return (
    <PendingRecipeClient
      pendingId={pendingId}
      recipe={row.generated_recipe as GeneratedRecipe}
      cookedCount={row.cooked_count}
      status={row.status}
      youtubeVideoId={row.youtube_video_id ?? null}
    />
  );
}
