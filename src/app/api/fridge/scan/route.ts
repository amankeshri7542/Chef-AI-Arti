import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractIngredients } from '@/lib/openai';
import { checkRateLimit, getRateLimitRemaining } from '@/lib/redis';
import type { IngredientChip } from '@/types/index';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // checkRateLimit increments the counter — this is the one call that consumes a scan token
  const allowed = await checkRateLimit(userId, 'scan');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Aaj 2 scans ho gaye! Kal phir aana 📸', hinglish: true },
      { status: 429 },
    );
  }

  const { imageBase64 }: { imageBase64: string } = await req.json();
  const raw = await extractIngredients(imageBase64);

  const chips: IngredientChip[] = raw.map((item) => ({
    name: item.name,
    confidence: item.confidence,
    user_added: false,
    removed: false,
  }));

  const remaining = await getRateLimitRemaining(userId, 'scan');

  return NextResponse.json({ chips, remaining, total: chips.length });
}
