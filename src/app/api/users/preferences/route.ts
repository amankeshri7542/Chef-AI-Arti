import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type {
  CookingFor,
  CookingSkill,
  DietType,
  SpiceLevel,
  TimePreference,
  UnitPreference,
} from '@/types/index';

const UNITS: UnitPreference[] = ['desi', 'metric'];
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

// family_size drives portion scaling — keep it in sync when cooking_for changes.
const FAMILY_SIZE_BY_COOKING_FOR: Record<CookingFor, number> = {
  alone: 1,
  couple: 2,
  family: 4,
  pg: 1,
};

interface PreferencesBody {
  preferred_unit?: UnitPreference;
  diet_type?: DietType;
  preferred_region?: string;
  spice_preference?: SpiceLevel;
  cooking_for?: CookingFor;
  cooking_skill?: CookingSkill;
  time_preference?: TimePreference;
  kitchen_setup?: string[];
  family_size?: number;
}

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Parse body
  let body: PreferencesBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // 3. Validate provided fields only; build the partial update
  const update: Record<string, unknown> = {};

  if (body.preferred_unit !== undefined) {
    if (!UNITS.includes(body.preferred_unit)) {
      return NextResponse.json({ error: 'Invalid preferred_unit' }, { status: 400 });
    }
    update.preferred_unit = body.preferred_unit;
  }
  if (body.diet_type !== undefined) {
    if (!DIET_TYPES.includes(body.diet_type)) {
      return NextResponse.json({ error: 'Invalid diet_type' }, { status: 400 });
    }
    update.diet_type = body.diet_type;
  }
  if (body.preferred_region !== undefined) {
    if (!REGIONS.includes(body.preferred_region)) {
      return NextResponse.json({ error: 'Invalid preferred_region' }, { status: 400 });
    }
    update.preferred_region = body.preferred_region;
  }
  if (body.spice_preference !== undefined) {
    if (!SPICE_LEVELS.includes(body.spice_preference)) {
      return NextResponse.json({ error: 'Invalid spice_preference' }, { status: 400 });
    }
    update.spice_preference = body.spice_preference;
  }
  if (body.cooking_for !== undefined) {
    if (!COOKING_FOR.includes(body.cooking_for)) {
      return NextResponse.json({ error: 'Invalid cooking_for' }, { status: 400 });
    }
    update.cooking_for = body.cooking_for;
    // Only derive family_size from cooking_for when the caller didn't set an
    // explicit count — users can pick an exact household size in profile, and
    // that must not be silently overwritten back to the bucket default.
    if (body.family_size === undefined) {
      update.family_size = FAMILY_SIZE_BY_COOKING_FOR[body.cooking_for];
    }
  }
  if (body.family_size !== undefined) {
    if (!Number.isInteger(body.family_size) || body.family_size < 1 || body.family_size > 15) {
      return NextResponse.json({ error: 'Invalid family_size' }, { status: 400 });
    }
    update.family_size = body.family_size;
  }
  if (body.cooking_skill !== undefined) {
    if (!SKILLS.includes(body.cooking_skill)) {
      return NextResponse.json({ error: 'Invalid cooking_skill' }, { status: 400 });
    }
    update.cooking_skill = body.cooking_skill;
  }
  if (body.time_preference !== undefined) {
    if (!TIME_PREFS.includes(body.time_preference)) {
      return NextResponse.json({ error: 'Invalid time_preference' }, { status: 400 });
    }
    update.time_preference = body.time_preference;
  }
  if (body.kitchen_setup !== undefined) {
    if (
      !Array.isArray(body.kitchen_setup) ||
      body.kitchen_setup.length === 0 ||
      body.kitchen_setup.some((k) => !KITCHEN_ITEMS.includes(k))
    ) {
      return NextResponse.json({ error: 'Invalid kitchen_setup' }, { status: 400 });
    }
    update.kitchen_setup = [...new Set(body.kitchen_setup)];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Kuch bhi update nahi mila' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 4. Update user
  const { error } = await supabase
    .from('users')
    .update(update)
    .eq('clerk_user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
