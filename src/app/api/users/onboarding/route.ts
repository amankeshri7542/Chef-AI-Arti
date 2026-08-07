import { auth, currentUser } from '@clerk/nextjs/server';
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

function internalError(requestId: string) {
  return NextResponse.json(
    {
      error: 'Preferences save nahi ho paayi. Dobara try karein.',
      requestId,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  let body: OnboardingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body', requestId }, { status: 400 });
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
    return NextResponse.json({ error: 'Invalid cooking_for', requestId }, { status: 400 });
  }
  if (!diet_type || !DIET_TYPES.includes(diet_type)) {
    return NextResponse.json({ error: 'Invalid diet_type', requestId }, { status: 400 });
  }
  if (!preferred_region || !REGIONS.includes(preferred_region)) {
    return NextResponse.json({ error: 'Invalid preferred_region', requestId }, { status: 400 });
  }
  if (!spice_preference || !SPICE_LEVELS.includes(spice_preference)) {
    return NextResponse.json({ error: 'Invalid spice_preference', requestId }, { status: 400 });
  }
  if (!cooking_skill || !SKILLS.includes(cooking_skill)) {
    return NextResponse.json({ error: 'Invalid cooking_skill', requestId }, { status: 400 });
  }
  if (!time_preference || !TIME_PREFS.includes(time_preference)) {
    return NextResponse.json({ error: 'Invalid time_preference', requestId }, { status: 400 });
  }
  if (
    !Array.isArray(kitchen_setup) ||
    kitchen_setup.length === 0 ||
    kitchen_setup.some((item) => !KITCHEN_ITEMS.includes(item))
  ) {
    return NextResponse.json({ error: 'Invalid kitchen_setup', requestId }, { status: 400 });
  }

  const supabase = createServerClient();
  const uniqueKitchen = [...new Set(kitchen_setup)];

  // The OAuth sync route is best-effort. Ensure a database user exists here as
  // well so a missed sync can never strand somebody on the final onboarding step.
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, restrictions')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (lookupError) {
    console.error('[onboarding] user lookup failed', {
      requestId,
      userId,
      code: lookupError.code,
      message: lookupError.message,
    });
    return internalError(requestId);
  }

  let restrictions = Array.isArray(existingUser?.restrictions)
    ? existingUser.restrictions.filter((item): item is string => typeof item === 'string')
    : [];

  if (!existingUser) {
    const clerkUser = await currentUser();
    const rawName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
    const name = clerkUser?.fullName ?? (rawName || null);

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
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
      })
      .select('id, restrictions')
      .single();

    if (insertError || !insertedUser) {
      console.error('[onboarding] fallback user creation failed', {
        requestId,
        userId,
        code: insertError?.code,
        message: insertError?.message,
      });
      return internalError(requestId);
    }

    restrictions = [];
  }

  // Completion and portion scaling use columns present since the first schema.
  // Keep this small and atomic; newer personalization columns are saved below.
  const { error: completionError } = await supabase
    .from('users')
    .update({
      family_size: FAMILY_SIZE_BY_COOKING_FOR[cooking_for],
      onboarding_done: true,
    })
    .eq('clerk_user_id', userId);

  if (completionError) {
    console.error('[onboarding] core completion update failed', {
      requestId,
      userId,
      code: completionError.code,
      message: completionError.message,
    });
    return internalError(requestId);
  }

  const warnings: string[] = [];

  // Save diet separately because older databases may still have a legacy check
  // constraint that only accepts veg/non-veg/eggetarian. Vegan/Jain users remain
  // safely vegetarian and retain the specific choice as a restriction tag.
  const { error: dietError } = await supabase
    .from('users')
    .update({ diet_type })
    .eq('clerk_user_id', userId);

  if (dietError) {
    if (diet_type === 'vegan' || diet_type === 'jain') {
      restrictions = [...new Set([...restrictions, diet_type])];
      const { error: fallbackDietError } = await supabase
        .from('users')
        .update({ diet_type: 'veg', restrictions })
        .eq('clerk_user_id', userId);

      if (fallbackDietError) {
        warnings.push('diet_type');
        console.error('[onboarding] diet fallback failed', {
          requestId,
          userId,
          code: fallbackDietError.code,
          message: fallbackDietError.message,
        });
      } else {
        warnings.push('diet_type_legacy_fallback');
      }
    } else {
      warnings.push('diet_type');
      console.error('[onboarding] diet update failed', {
        requestId,
        userId,
        code: dietError.code,
        message: dietError.message,
      });
    }
  }

  // These fields were introduced over several migrations. Writing them one at a
  // time prevents one stale column or constraint from rolling back the entire
  // onboarding journey. Every failure is logged with a request ID for diagnosis.
  const optionalWrites: Array<[string, Record<string, unknown>]> = [
    ['preferred_region', { preferred_region }],
    ['spice_preference', { spice_preference }],
    ['cooking_for', { cooking_for }],
    ['cooking_skill', { cooking_skill }],
    ['time_preference', { time_preference }],
    ['kitchen_setup', { kitchen_setup: uniqueKitchen }],
    ['onboarding_v2_done', { onboarding_v2_done: true }],
  ];

  for (const [field, payload] of optionalWrites) {
    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('clerk_user_id', userId);

    if (error) {
      warnings.push(field);
      console.error('[onboarding] optional preference update failed', {
        requestId,
        userId,
        field,
        code: error.code,
        message: error.message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    degraded: warnings.length > 0,
    warnings,
    requestId,
  });
}
