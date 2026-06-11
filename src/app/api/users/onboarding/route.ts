import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type {
  CookingFor,
  CookingSkill,
  DietType,
  SpiceLevel,
  TimePreference,
} from '@/types/index';

const DIET_TYPES: DietType[] = ['veg', 'non-veg', 'eggetarian', 'vegan', 'jain'];
const REGIONS = [
  'Punjab-Haryana',
  'UP-Bihar',
  'Delhi-NCR',
  'Rajasthan-MP',
  'south-indian',
  'bengali',
  'gujarati',
  'maharashtrian',
  'any',
];
const SPICE_LEVELS: SpiceLevel[] = ['mild', 'medium', 'hot'];
const COOKING_FOR: CookingFor[] = ['alone', 'couple', 'family', 'pg'];
const SKILLS: CookingSkill[] = ['beginner', 'intermediate', 'expert'];
const TIME_PREFS: TimePreference[] = ['15min', '30min', 'any'];
const KITCHEN_ITEMS = [
  'gas-stove',
  'induction',
  'microwave',
  'air-fryer',
  'pressure-cooker',
];

// family_size drives portion scaling app-wide — derive it from cooking_for.
const FAMILY_SIZE_BY_COOKING_FOR: Record<CookingFor, number> = {
  alone: 1,
  couple: 2,
  family: 4,
  pg: 1,
};

interface OnboardingBody {
  cooking_for?: CookingFor;
  diet_type?: DietType;
  preferred_region?: string;
  spice_preference?: SpiceLevel;
  cooking_skill?: CookingSkill;
  time_preference?: TimePreference;
  kitchen_setup?: string[];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: OnboardingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const {
    cooking_for,
    diet_type,
    preferred_region,
    spice_preference,
    cooking_skill,
    time_preference,
    kitchen_setup,
  } = body;

  if (!cooking_for || !COOKING_FOR.includes(cooking_for)) {
    return NextResponse.json({ error: 'Invalid cooking_for' }, { status: 400 });
  }
  if (!diet_type || !DIET_TYPES.includes(diet_type)) {
    return NextResponse.json({ error: 'Invalid diet_type' }, { status: 400 });
  }
  if (!preferred_region || !REGIONS.includes(preferred_region)) {
    return NextResponse.json({ error: 'Invalid preferred_region' }, { status: 400 });
  }
  if (!spice_preference || !SPICE_LEVELS.includes(spice_preference)) {
    return NextResponse.json({ error: 'Invalid spice_preference' }, { status: 400 });
  }
  if (!cooking_skill || !SKILLS.includes(cooking_skill)) {
    return NextResponse.json({ error: 'Invalid cooking_skill' }, { status: 400 });
  }
  if (!time_preference || !TIME_PREFS.includes(time_preference)) {
    return NextResponse.json({ error: 'Invalid time_preference' }, { status: 400 });
  }
  if (
    !Array.isArray(kitchen_setup) ||
    kitchen_setup.length === 0 ||
    kitchen_setup.some((k) => !KITCHEN_ITEMS.includes(k))
  ) {
    return NextResponse.json({ error: 'Invalid kitchen_setup' }, { status: 400 });
  }

  const supabase = createServerClient();

  // upsert so this is idempotent even if the user row was never created
  const { error } = await supabase.from('users').upsert(
    {
      clerk_user_id: userId,
      cooking_for,
      diet_type,
      preferred_region,
      spice_preference,
      cooking_skill,
      time_preference,
      kitchen_setup: [...new Set(kitchen_setup)],
      family_size: FAMILY_SIZE_BY_COOKING_FOR[cooking_for],
      onboarding_done: true,
      onboarding_v2_done: true,
    },
    { onConflict: 'clerk_user_id', ignoreDuplicates: false },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
