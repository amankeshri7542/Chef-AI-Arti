import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
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

// ─── Shared handler logic ─────────────────────────────────────────────────────

interface SearchParams {
  query?: string;
  orderBy?: 'cooked_count' | 'like_count';
  category?: string;
  tag?: string;
  is_vrat_friendly?: boolean;
  vibe?: string;
  limit?: number;
}

async function handleSearch(params: SearchParams, userId: string | null) {
  const { query, orderBy, category, tag, is_vrat_friendly, vibe, limit } = params;

  const hasQuery = !!query?.trim();
  const hasFilters = !!(orderBy || category || tag || is_vrat_friendly || vibe);

  if (!hasQuery && !hasFilters) {
    return NextResponse.json({ error: 'Query ya filter chahiye' }, { status: 400 });
  }

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
      const subStatus = (
        (user as { subscription_status?: string }).subscription_status === 'paid' ? 'paid' : 'free'
      ) as 'free' | 'paid';

      const allowed = await checkRateLimit(userId, 'recipes', subStatus);
      if (!allowed) {
        const rateLimit = RATE_LIMITS[subStatus].recipes;
        return NextResponse.json(
          { error: `Aaj ke ${rateLimit} recipes ho gaye! Kal aur dekhna 😊` },
          { status: 429 },
        );
      }
      remaining = await getRateLimitRemaining(userId, 'recipes', subStatus);
    }
  }

  // Filter-only path — SQL, no embedding
  if (!hasQuery && hasFilters) {
    try {
      const supabase = createServerClient();
      let q = supabase
        .from('recipes')
        .select('*')
        .eq('source', 'curated')
        .eq('reported_count', 0);

      if (category) q = q.eq('category', category);
      if (is_vrat_friendly) q = q.eq('is_vrat_friendly', true);
      if (tag) q = q.contains('tags', [tag]);
      if (vibe) q = q.contains('vibes', [vibe]);

      const orderCol = orderBy ?? 'cooked_count';
      q = q.order(orderCol, { ascending: false });
      q = q.limit(limit ?? 20);

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
      query!,
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

// ─── GET — primary handler (SW-safe, cacheable by client) ────────────────────

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const sp = request.nextUrl.searchParams;

  const params: SearchParams = {
    query: sp.get('q') ?? undefined,
    orderBy: (sp.get('orderBy') as SearchParams['orderBy']) ?? undefined,
    category: sp.get('category') ?? undefined,
    tag: sp.get('tag') ?? undefined,
    is_vrat_friendly: sp.get('vrat') === 'true' ? true : undefined,
    vibe: sp.get('vibe') ?? undefined,
    limit: sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined,
  };

  return handleSearch(params, userId);
}

// ─── POST — kept for backward compat (fridge scan, collection browse) ────────

interface SearchBody extends SearchParams {}

export async function POST(request: Request) {
  const { userId } = await auth();
  const body: SearchBody = await request.json();
  return handleSearch(body, userId);
}
