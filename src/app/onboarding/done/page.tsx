import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase';
import DoneClient from './DoneClient';
import type { Recipe, RegionOrigin, User } from '@/types/index';

// Onboarding stores broad region buckets; recipes use granular region_origin.
// Map the bucket → the region_origin values we want to match against.
const REGION_MAP: Record<string, RegionOrigin[]> = {
  'UP-Bihar': ['UP', 'Bihar', 'Jharkhand'],
  'Delhi-NCR': ['Delhi-NCR'],
  'Punjab-Haryana': ['Punjab', 'Haryana'],
  'Rajasthan-MP': ['Rajasthan', 'MP'],
};

export default async function OnboardingDonePage() {
  const { userId } = await auth();
  const supabase = createServerClient();

  // Fetch the user's preferences (best-effort)
  let diet: string | null = null;
  let region: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('diet_type, preferred_region')
      .eq('clerk_user_id', userId)
      .single<Pick<User, 'diet_type' | 'preferred_region'>>();
    diet = data?.diet_type ?? null;
    region = data?.preferred_region ?? null;
  }

  const regionOrigins = region ? REGION_MAP[region] : undefined;
  const wantRegions: RegionOrigin[] = [
    ...(regionOrigins ?? []),
    'pan-north-indian',
  ];

  // Personalized: diet match + region (or pan-north-indian), most cooked first.
  let recipes: Recipe[] = [];
  if (diet) {
    let q = supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .eq('diet_type', diet);

    if (regionOrigins && regionOrigins.length > 0) {
      q = q.in('region_origin', wantRegions);
    }

    const { data } = await q
      .order('cooked_count', { ascending: false })
      .limit(3)
      .returns<Recipe[]>();
    recipes = data ?? [];
  }

  // Fallback: top curated recipes (diet-only or fully generic) if nothing matched.
  if (recipes.length < 3) {
    let fb = supabase.from('recipes').select('*').eq('source', 'curated');
    if (diet) fb = fb.eq('diet_type', diet);
    const { data } = await fb
      .order('cooked_count', { ascending: false })
      .limit(3)
      .returns<Recipe[]>();
    if ((data?.length ?? 0) >= recipes.length) recipes = data ?? recipes;
  }

  // Last resort: any curated top 3 (e.g. user had no diet set).
  if (recipes.length === 0) {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('source', 'curated')
      .order('cooked_count', { ascending: false })
      .limit(3)
      .returns<Recipe[]>();
    recipes = data ?? [];
  }

  return <DoneClient recipes={recipes} />;
}
