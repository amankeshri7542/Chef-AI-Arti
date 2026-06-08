import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import type { User } from '@/types/index';

export async function POST(request: Request) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Get user context from DB (needed for rate-limit tier + RAG context)
  const supabase = createServerClient();
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select(
      'diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients, subscription_status',
    )
    .eq('clerk_user_id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const subStatus = ((user as { subscription_status?: string }).subscription_status === 'paid' ? 'paid' : 'free') as 'free' | 'paid';

  // 3. Rate limit check BEFORE doing expensive work
  // checkRateLimit increments the counter internally — no separate increment needed
  const allowed = await checkRateLimit(userId, 'recipes', subStatus);
  if (!allowed) {
    const limit = RATE_LIMITS[subStatus].recipes;
    return NextResponse.json(
      { error: `Aaj ke ${limit} recipes ho gaye! Kal aur dekhna 😊` },
      { status: 429 },
    );
  }

  // 4. Parse body
  const body: { query: string; appliesTo?: string[] } = await request.json();
  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
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
  const remaining = await getRateLimitRemaining(userId, 'recipes', subStatus);

  return NextResponse.json({ ...result, remaining });
}
