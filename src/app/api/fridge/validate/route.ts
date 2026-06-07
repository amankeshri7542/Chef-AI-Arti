import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateImage } from '@/lib/openai';
import { getRateLimitRemaining } from '@/lib/redis';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Peek without consuming — scan token is only spent on successful extractIngredients
  const remaining = await getRateLimitRemaining(userId, 'scan');
  if (remaining <= 0) {
    return NextResponse.json(
      { error: 'Aaj 2 scans ho gaye! Kal phir aana 📸', hinglish: true },
      { status: 429 },
    );
  }

  const { imageBase64 }: { imageBase64: string } = await req.json();
  const result = await validateImage(imageBase64);

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
}
