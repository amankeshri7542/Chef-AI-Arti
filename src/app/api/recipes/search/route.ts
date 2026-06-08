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

interface SearchBody {
  query?: string;
  // Collection / browse filters (no query required)
  orderBy?: 'cooked_count' | 'like_count';
  category?: string;
  tag?: string;
  is_vrat_friendly?: boolean;
  vibe?: string;
  limit?: number;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  const body: SearchBody = await request.json();

  const hasQuery = !!body.query?.trim();
  const hasFilters = !!(body.orderBy || body.category || body.tag || body.is_vrat_friendly || body.vibe);

  if (!hasQuery && !hasFilters) {
    return NextResponse.json({ error: 'Query ya filter chahiye' }, { status: 400 });
  }

  // For authenticated users: get user context + rate limit
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

  // Filter-only path — no embedding, just SQL
  if (!hasQuery && hasFilters) {
    try {
      const supabase = createServerClient();
      let q = supabase
        .from('recipes')
        .select('*')
        .eq('source', 'curated')
        .eq('reported_count', 0);

      if (body.category) q = q.eq('category', body.category);
      if (body.is_vrat_friendly) q = q.eq('is_vrat_friendly', true);
      if (body.tag) q = q.contains('tags', [body.tag]);
      if (body.vibe) q = q.contains('vibes', [body.vibe]);

      const orderCol = body.orderBy ?? 'cooked_count';
      q = q.order(orderCol, { ascending: false });
      q = q.limit(body.limit ?? 20);

      const { data, error } = await q;
      if (error) throw error;

      return NextResponse.json({
        recipes: data ?? [],
        isEmptyStateFallback: false,
        triggerCase2: false,
        ...(remaining !== undefined ? { remaining } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[search] filter error:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // RAG search path
  try {
    const result = await searchRecipes(
      body.query!,
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
