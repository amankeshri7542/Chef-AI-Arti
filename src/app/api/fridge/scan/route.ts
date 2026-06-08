import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractIngredients } from '@/lib/openai';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import { createServerClient } from '@/lib/supabase';
import type { IngredientChip } from '@/types/index';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('clerk_user_id', userId)
    .single();
  const subStatus = (user?.subscription_status === 'paid' ? 'paid' : 'free') as 'free' | 'paid';

  // checkRateLimit increments the counter — this is the one call that consumes a scan token
  const allowed = await checkRateLimit(userId, 'scan', subStatus);
  if (!allowed) {
    const limit = RATE_LIMITS[subStatus].scan;
    return NextResponse.json(
      { error: `Aaj ${limit} scans ho gaye! Kal phir aana 📸`, hinglish: true },
      { status: 429 },
    );
  }

  const { imageBase64 }: { imageBase64: string } = await req.json();
  const raw = await extractIngredients(imageBase64);
  console.log('[fridge/scan] extracted:', raw.length, 'ingredients');

  const chips: IngredientChip[] = raw.map((item) => ({
    name: item.name,
    confidence: item.confidence,
    user_added: false,
    removed: false,
  }));

  const remaining = await getRateLimitRemaining(userId, 'scan', subStatus);

  return NextResponse.json({ chips, remaining, total: chips.length });
}
