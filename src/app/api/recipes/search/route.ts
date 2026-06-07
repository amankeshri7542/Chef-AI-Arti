import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { checkRateLimit, getRateLimitRemaining } from '@/lib/redis';
import type { User } from '@/types/index';

export async function POST(request: Request) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Rate limit check BEFORE doing expensive work
  // checkRateLimit increments the counter internally — no separate increment needed
  const allowed = await checkRateLimit(userId, 'recipes');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Aaj ke recipes ho gaye! Kal aur dekhna 😊' },
      { status: 429 },
    );
  }

  // 3. Parse body
  const body: { query: string; appliesTo?: string[] } = await request.json();
  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  // 4. Get user context from DB
  const supabase = createServerClient();
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select(
      'diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients',
    )
    .eq('clerk_user_id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 5. RAG search
  const result = await searchRecipes(
    body.query,
    user as Pick<
      User,
      | 'diet_type'
      | 'is_vrat_mode'
      | 'restrictions'
      | 'family_size'
      | 'spice_preference'
      | 'preferred_region'
      | 'disliked_ingredients'
    >,
    userId,
  );

  // 6. Get remaining count for UI display
  const remaining = await getRateLimitRemaining(userId, 'recipes');

  return NextResponse.json({ ...result, remaining });
}
