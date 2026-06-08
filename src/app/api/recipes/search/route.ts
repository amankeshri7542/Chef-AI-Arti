import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import type { User } from '@/types/index';

const GUEST_USER_CONTEXT = {
  diet_type: 'veg' as const,
  is_vrat_mode: false,
  restrictions: [] as string[],
  family_size: 4,
  spice_preference: 'medium' as const,
  preferred_region: null,
  disliked_ingredients: [] as string[],
};

export async function POST(request: Request) {
  // 1. Auth (optional — public search allowed for guests)
  const { userId } = await auth();

  // 2. Parse body early so we can fail fast
  const body: { query: string; appliesTo?: string[] } = await request.json();
  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  // 3. For authenticated users: get user context + rate limit
  let userContext = GUEST_USER_CONTEXT;
  let remaining: number | undefined;

  if (userId) {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select(
        'diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients, subscription_status',
      )
      .eq('clerk_user_id', userId)
      .single();

    if (user) {
      userContext = user as typeof GUEST_USER_CONTEXT;
      const subStatus = ((user as { subscription_status?: string }).subscription_status === 'paid' ? 'paid' : 'free') as 'free' | 'paid';

      const allowed = await checkRateLimit(userId, 'recipes', subStatus);
      if (!allowed) {
        const limit = RATE_LIMITS[subStatus].recipes;
        return NextResponse.json(
          { error: `Aaj ke ${limit} recipes ho gaye! Kal aur dekhna 😊` },
          { status: 429 },
        );
      }
      remaining = await getRateLimitRemaining(userId, 'recipes', subStatus);
    }
  }

  // 4. RAG search (works for both guests and authenticated users)
  try {
    const result = await searchRecipes(
      body.query,
      userContext as Pick<
        User,
        | 'diet_type'
        | 'is_vrat_mode'
        | 'restrictions'
        | 'family_size'
        | 'spice_preference'
        | 'preferred_region'
        | 'disliked_ingredients'
      >,
      userId ?? 'guest',
    );
    return NextResponse.json({ ...result, ...(remaining !== undefined ? { remaining } : {}) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] RAG error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
