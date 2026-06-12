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
    .select(
      'id, generated_recipe, cooked_count, status, shown_to_user_ids, youtube_video_id, promoted_recipe_id',
    )
    .eq('id', pendingId)
    .single<
      Pick<
        RecipePending,
        | 'id'
        | 'generated_recipe'
        | 'cooked_count'
        | 'status'
        | 'shown_to_user_ids'
        | 'youtube_video_id'
        | 'promoted_recipe_id'
      >
    >();

  // Pending recipes are private to the users they've been shown to.
  if (!row || !(row.shown_to_user_ids ?? []).includes(user.id)) {
    notFound();
  }

  // Promoted → the recipe now lives in the real library; old pending links
  // (history, chat, revisits) must not dead-end on a stale cook flow.
  if (row.status === 'promoted' && row.promoted_recipe_id) {
    redirect(`/recipe/${row.promoted_recipe_id}`);
  }
  if (row.status === 'rejected') {
    const name =
      (row.generated_recipe as GeneratedRecipe | null)?.name_hinglish ?? 'Yeh recipe';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--cream)]">
        <span className="text-5xl mb-4">🍲</span>
        <h1 className="font-display text-xl text-[var(--terracotta)] mb-2">
          {name} abhi available nahi hai
        </h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          Humne ise review kiya aur abhi ke liye hata diya hai. Koi baat nahi —
          Arti se koi aur recipe banwa lijiye!
        </p>
        <a
          href="/home"
          className="min-h-[48px] px-6 py-3 rounded-full bg-[var(--saffron)] text-white text-sm font-semibold flex items-center"
        >
          Ghar wapas chalein 🏠
        </a>
      </div>
    );
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
