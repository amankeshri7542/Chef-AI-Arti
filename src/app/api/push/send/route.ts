import { NextRequest, NextResponse } from 'next/server';
import { sendPushToUser, type PushPayload } from '@/lib/push';

/**
 * Internal-only: send a push to one user. Guarded by CRON_SECRET.
 * Callers (cron jobs, internal services) must pass `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { userId?: string } & Partial<PushPayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  if (!body.userId || !body.title || !body.body) {
    return NextResponse.json({ error: 'userId, title, body required' }, { status: 400 });
  }

  const delivered = await sendPushToUser(body.userId, {
    title: body.title,
    body: body.body,
    url: body.url,
  });

  return NextResponse.json({ ok: true, delivered });
}
