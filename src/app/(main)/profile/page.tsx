import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import ProfileClient from './ProfileClient';
import type { Recipe, User } from '@/types/index';

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Get Clerk user for display name
  const clerkUser = await currentUser();

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, subscription_status, subscription_ends_at, diet_type, family_size, preferred_unit, preferred_region, spice_preference, cooking_skill, time_preference, kitchen_setup')
    .eq('clerk_user_id', userId)
    .single<Pick<User, 'id' | 'subscription_status' | 'subscription_ends_at' | 'diet_type' | 'family_size' | 'preferred_unit' | 'preferred_region' | 'spice_preference' | 'cooking_skill' | 'time_preference' | 'kitchen_setup'>>();

  // Fallback defaults if user row not found
  const name = clerkUser?.fullName ?? clerkUser?.firstName ?? null;

  // Recipes Arti generated for this user (CASE 2) — pending, owned by them.
  // These live only in recipes_pending and have no other entry point, so
  // without this list they vanish after the one post-generate view.
  let generatedRecipes: { id: string; name: string; youtubeVideoId: string | null }[] = [];
  if (user?.id) {
    const { data: pendingRows } = await supabase
      .from('recipes_pending')
      .select('id, generated_recipe, youtube_video_id, created_at')
      .contains('shown_to_user_ids', [user.id])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    generatedRecipes = (pendingRows ?? []).map(
      (row: { id: string; generated_recipe: { name_hinglish?: string } | null; youtube_video_id: string | null }) => ({
        id: row.id,
        name: row.generated_recipe?.name_hinglish ?? 'Arti ki recipe',
        youtubeVideoId: row.youtube_video_id ?? null,
      }),
    );
  }

  // Saved recipes (heart button) — same query as GET /api/recipes/saved
  const { data: savedRows } = await supabase
    .from('recipe_saves')
    .select('recipes(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const savedRecipes = (savedRows ?? [])
    .map((row: { recipes: unknown }) => row.recipes as Recipe)
    .filter(Boolean);

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
        preferredRegion={user?.preferred_region ?? null}
        spicePreference={user?.spice_preference ?? 'medium'}
        cookingSkill={user?.cooking_skill ?? null}
        timePreference={user?.time_preference ?? null}
        kitchenSetup={user?.kitchen_setup ?? []}
        savedRecipes={savedRecipes}
        generatedRecipes={generatedRecipes}
      />
    </div>
  );
}
