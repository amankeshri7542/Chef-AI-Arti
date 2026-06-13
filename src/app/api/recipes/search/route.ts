import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { searchRecipes } from '@/lib/rag';
import { buildHinglishQuery, INGREDIENT_EN_TO_HI } from '@/lib/ingredient-map';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import type { Recipe, User } from '@/types/index';

/** Character-trigram similarity (0–1) — same idea as pg_trgm similarity(). */
function trigramSim(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const p = `  ${s.toLowerCase()}  `;
    const set = new Set<string>();
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
    return set;
  };
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return ta.size + tb.size === 0 ? 0 : (2 * intersection) / (ta.size + tb.size);
}

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

async function handleSearch(params: SearchParams, userId: string | null, ip: string) {
  const { query, orderBy, category, tag, is_vrat_friendly, vibe, limit } = params;

  const hasQuery = !!query?.trim();
  const hasFilters = !!(orderBy || category || tag || is_vrat_friendly || vibe);

  if (!hasQuery && !hasFilters) {
    return NextResponse.json({ error: 'Query ya filter chahiye' }, { status: 400 });
  }

  // Guest text search hits the embedding API (real cost on a public route) —
  // cap per IP per day so an unauthenticated flood can't burn OpenAI credits.
  // Filter-only browsing (no query) stays uncapped: it's pure SQL.
  if (!userId && hasQuery) {
    const allowed = await checkRateLimit(`ip:${ip}`, 'guest-search', 'free');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Aaj ke liye search ho gayi! Login karke aur dhundein 😊' },
        { status: 429 },
      );
    }
  }

  let userContext = GUEST_USER_CONTEXT;
  let remaining: number | undefined;

  if (userId) {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select(
        'diet_type, is_vrat_mode, restrictions, family_size, spice_preference, preferred_region, disliked_ingredients, time_preference, cooking_skill, kitchen_setup, subscription_status',
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
      Sentry.captureException(err);
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[search] filter error:', msg);
      return NextResponse.json({ error: 'Kuch gadbad ho gayi 😅' }, { status: 500 });
    }
  }

  // Text query path — direct name/tag match FIRST, vector search after.
  // Recipe embeddings don't strongly match bare dish names ("paratha"),
  // so a plain SQL ilike on name_hinglish must win over vector similarity.
  try {
    const supabase = createServerClient();
    const raw = query!.trim();
    // Sanitize for PostgREST .or() syntax (commas/parens are separators)
    const rawClean = raw.replace(/[%_,()]/g, '').trim();
    const words = rawClean.toLowerCase().split(/\s+/).filter(Boolean);
    // English→Hinglish so "rice" also direct-matches "Chawal" names/tags
    const hinglishWords = words
      .map((w) => INGREDIENT_EN_TO_HI[w])
      .filter((w): w is string => !!w);
    // Include individual words so typo queries ("Malasa Dosa") still ILIKE-match
    // on the correctly-spelled word tokens ("dosa" → hits Dosa recipes).
    const nameTerms = [...new Set([rawClean, ...words, ...hinglishWords])].filter(Boolean);
    const tagTerms = [...new Set([rawClean.toLowerCase(), ...words, ...hinglishWords])];
    const nameOrExpr = nameTerms.map((t) => `name_hinglish.ilike.%${t}%`).join(',');

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
          .or(nameOrExpr)
          .eq('source', 'curated')
          .eq('reported_count', 0),
      )
        .order('cooked_count', { ascending: false })
        .limit(10),
      applyUserFilters(
        supabase
          .from('recipes')
          .select('*')
          .overlaps('tags', tagTerms)
          .eq('source', 'curated')
          .eq('reported_count', 0),
      )
        .order('cooked_count', { ascending: false })
        .limit(5),
    ]);

    const nameMatches = (nameRows ?? []) as Recipe[];
    const tagMatches = (tagRows ?? []) as Recipe[];

    if (nameMatches.length > 0 || tagMatches.length > 0) {
      // Priority: exact name > trigram similarity (shorter/closer names rank above
      // recipes that merely share one word like "masala") > cooked_count tiebreak.
      const lower = raw.toLowerCase();
      nameMatches.sort((a, b) => {
        const aExact = a.name_hinglish.toLowerCase() === lower ? 1 : 0;
        const bExact = b.name_hinglish.toLowerCase() === lower ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aSim = trigramSim(a.name_hinglish, raw);
        const bSim = trigramSim(b.name_hinglish, raw);
        if (Math.abs(bSim - aSim) > 0.05) return bSim - aSim;
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
      if (combined.length < 6) {
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
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] RAG error:', msg);
    return NextResponse.json({ error: 'Kuch gadbad ho gayi 😅' }, { status: 500 });
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

  return handleSearch(params, userId, clientIp(request.headers));
}

// ─── POST — kept for backward compat (fridge scan, collection browse) ────────

interface SearchBody extends SearchParams {}

export async function POST(request: Request) {
  const { userId } = await auth();
  const body: SearchBody = await request.json();
  return handleSearch(body, userId, clientIp(request.headers));
}

function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
