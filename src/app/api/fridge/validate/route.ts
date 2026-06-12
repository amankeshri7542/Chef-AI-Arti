import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { validateImage } from '@/lib/openai';
import { checkRateLimit, getRateLimitRemaining, RATE_LIMITS } from '@/lib/redis';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Whole-route guard: Supabase, Redis, body parse or vision call throwing
  // returns a Hinglish 500 instead of an unhandled crash.
  try {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('clerk_user_id', userId)
      .single();
    const subStatus = (user?.subscription_status === 'paid' ? 'paid' : 'free') as 'free' | 'paid';

    // Peek without consuming — scan token is only spent on successful extractIngredients
    const remaining = await getRateLimitRemaining(userId, 'scan', subStatus);
    if (remaining <= 0) {
      const limit = RATE_LIMITS[subStatus].scan;
      return NextResponse.json(
        { error: `Aaj ${limit} scans ho gaye! Kal phir aana 📸`, hinglish: true },
        { status: 429 },
      );
    }

    // Validate is itself a vision call — meter it with its own counter so
    // repeated retries can't run an unmetered OpenAI bill (scan token is
    // only consumed later, on successful extraction).
    const validateAllowed = await checkRateLimit(userId, 'validate', subStatus);
    if (!validateAllowed) {
      return NextResponse.json(
        { error: 'Aaj ke liye photo checks ho gaye! Kal phir try karein 📸', hinglish: true },
        { status: 429 },
      );
    }

    const { imageBase64 }: { imageBase64: string } = await req.json();
    console.log('[fridge/validate] image size (chars):', imageBase64?.length ?? 0)
    const result = await validateImage(imageBase64);
    console.log('[fridge/validate] result:', result.valid, result.reason);

    if (!result.valid) {
      const reason = result.reason.toLowerCase();
      let message: string;
      if (reason.includes('blurry') || reason.includes('dark')) {
        message = 'Photo thodi saaf lo, roshni chahiye ☀️';
      } else if (
        reason.includes('person') ||
        reason.includes('nsfw') ||
        reason.includes('inappropriate')
      ) {
        message = 'Yeh sahi photo nahi hai. Fridge ya ingredients ki photo lo 📸';
      } else {
        message = 'Yeh fridge ki photo nahi lagti! Sahi photo lo 📸';
      }
      return NextResponse.json({ error: message, hinglish: true }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[fridge/validate]', error);
    return NextResponse.json(
      { error: 'Kuch gadbad ho gayi. Dobara try karein!' },
      { status: 500 },
    );
  }
}
