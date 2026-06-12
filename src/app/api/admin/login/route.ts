import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth';
import { checkAdminLoginAllowed, resetAdminLoginAttempts } from '@/lib/redis';

export async function POST(req: NextRequest) {
  // Brute-force lockout — 5 attempts per IP per rolling 15 min.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const allowed = await checkAdminLoginAllowed(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada koshishein. 15 minute baad try karein.' },
      { status: 429 },
    );
  }

  const { password } = (await req.json().catch(() => ({}))) as {
    password?: string;
  };

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Galat password!' }, { status: 401 });
  }

  await resetAdminLoginAttempts(ip);
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(password), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24h
  });
  return res;
}
