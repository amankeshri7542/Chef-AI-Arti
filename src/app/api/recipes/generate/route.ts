import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
import { generateRecipe } from '@/lib/generate-recipe';
import type { SubscriptionStatus } from '@/types/index';

export async function POST(req: NextRequest) {
  // 1. Auth — Clerk string id
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 2. Resolve internal user (UUID + tier)
  const { data: user } = await supabase
    .from('users')
    .select('id, subscription_status')
    .eq('clerk_user_id', userId)
    .single<{ id: string; subscription_status: SubscriptionStatus }>();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3. Parse + validate body
  let body: { ingredients?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Kuch ingredients bhejo' }, { status: 400 });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? (body.ingredients.filter((x) => typeof x === 'string') as string[])
    : [];
  const query = typeof body.query === 'string' ? body.query : undefined;

  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'Kuch ingredients bhejo' }, { status: 400 });
  }

  // 4. Dedup check BEFORE rate limit — so we don't burn a token on a no-op.
  // If this user already generated a pending recipe in the last 24h, return it.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('recipes_pending')
    .select('id, generated_recipe')
    .eq('requested_by', user.id)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; generated_recipe: unknown }>();

  if (existing) {
    return NextResponse.json({
      pendingId: existing.id,
      recipe: existing.generated_recipe,
      isGenerated: true,
    });
  }

  // 5. Rate limit (atomically increments — call exactly once)
  const allowed = await checkRateLimit(userId, 'ai-gen', user.subscription_status);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Aaj ki recipe generation limit ho gayi' },
      { status: 429 },
    );
  }

  // 6. Generate via GPT
  let recipe;
  try {
    recipe = await generateRecipe(ingredients, query);
  } catch {
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, thodi der mein try karein' },
      { status: 500 },
    );
  }

  // 7. Persist to recipes_pending (requester pre-seeded into shown_to_user_ids)
  const { data: inserted, error: insertErr } = await supabase
    .from('recipes_pending')
    .insert({
      requested_by: user.id,
      ingredients_in: ingredients,
      generated_recipe: recipe,
      status: 'pending',
      shown_to_user_ids: [user.id],
    })
    .select('id')
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: 'Arti abhi soch nahi paa rahi, thodi der mein try karein' },
      { status: 500 },
    );
  }

  // 8. Return
  return NextResponse.json({ pendingId: inserted.id, recipe, isGenerated: true });
}
