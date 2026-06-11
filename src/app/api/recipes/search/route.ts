import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { buildHinglishQuery } from '@/lib/ingredient-map';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import type { Recipe, User } from '@/types/index';

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

  // Text query path — direct name/tag match FIRST, vector search after.
  // Recipe embeddings don't strongly match bare dish names ("paratha"),
  // so a plain SQL ilike on name_hinglish must win over vector similarity.
  try {
    const supabase = createServerClient();
    const raw = query!.trim();
    const likeTerm = `%${raw.replace(/[%_]/g, '')}%`;

    const applyUserFilters = <T extends { eq: Function; in: Function }>(q: T): T => {
      let out = q;
      if (userContext.diet_type === 'veg') out = out.eq('diet_type', 'veg');
      else if (userContext.diet_type === 'eggetarian')
        out = out.in('diet_type', ['veg', 'eggetarian']);
      if (userContext.is_vrat_mode) out = out.eq('is_vrat_friendly', true);
      return out;
    };

    const [{ data: nameRows }, { data: tagRows }] = await Promise.all([
      applyUserFilters(
        supabase
          .from('recipes')
          .select('*')
          .ilike('name_hinglish', likeTerm)
          .eq('source', 'curated')
          .eq('reported_count', 0),
      )
        .order('cooked_count', { ascending: false })
        .limit(10),
      applyUserFilters(
        supabase
          .from('recipes')
          .select('*')
          .contains('tags', [raw.toLowerCase()])
          .eq('source', 'curated')
          .eq('reported_count', 0),
      )
        .order('cooked_count', { ascending: false })
        .limit(5),
    ]);

    const nameMatches = (nameRows ?? []) as Recipe[];
    const tagMatches = (tagRows ?? []) as Recipe[];

    if (nameMatches.length > 0 || tagMatches.length > 0) {
      // Priority: exact name > partial name > tag > vector fill
      const lower = raw.toLowerCase();
      nameMatches.sort((a, b) => {
        const aExact = a.name_hinglish.toLowerCase() === lower ? 1 : 0;
        const bExact = b.name_hinglish.toLowerCase() === lower ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return (b.cooked_count ?? 0) - (a.cooked_count ?? 0);
      });

      const seen = new Set<string>();
      const combined: Recipe[] = [];
      for (const r of [...nameMatches, ...tagMatches]) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          combined.push(r);
        }
      }

      // Fill with vector results only when direct matches are sparse
      if (combined.length < 3) {
        try {
          const vectorResult = await runVectorSearch(raw, userContext, userId);
          for (const r of vectorResult.recipes) {
            if (!seen.has(r.id) && combined.length < 10) {
              seen.add(r.id);
              combined.push(r);
            }
          }
        } catch (err) {
          console.error('[search] vector fill failed (direct matches still returned):', err);
        }
      }

      return NextResponse.json({
        recipes: combined.slice(0, 10),
        isEmptyStateFallback: false,
        triggerCase2: false,
        ...(remaining !== undefined ? { remaining } : {}),
      });
    }

    // No direct match — full RAG vector search
    const result = await runVectorSearch(raw, userContext, userId);
    return NextResponse.json({ ...result, ...(remaining !== undefined ? { remaining } : {}) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] RAG error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Embedding-based search. Translates English ingredient words to bilingual
// Hinglish terms ("potato aloo") before embedding — dish names pass through
// buildHinglishQuery unchanged, so this is safe for both query styles.
async function runVectorSearch(
  rawQuery: string,
  userContext: typeof GUEST_USER_CONTEXT,
  userId: string | null,
) {
  const words = rawQuery.split(/[,\s]+/).filter(Boolean);
  const translated = buildHinglishQuery(words);
  return searchRecipes(
    translated,
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
