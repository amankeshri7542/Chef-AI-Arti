import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';

/**
 * Vercel cron — runs daily at 8am IST (2:30 UTC, see vercel.json).
 * Sends a "Aaj kya banao?" nudge to users active in the last 7 days.
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Active users = cooked something in the last 7 days.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: historyRows } = await supabase
    .from('cooking_history')
    .select('user_id')
    .gte('cooked_at', sevenDaysAgo);

  const activeUserIds = Array.from(
    new Set((historyRows ?? []).map((h: { user_id: string }) => h.user_id)),
  );

  if (activeUserIds.length === 0) {
    return NextResponse.json({ ok: true, nudged: 0, delivered: 0 });
  }

  let delivered = 0;
  for (const userId of activeUserIds) {
    delivered += await sendPushToUser(userId, {
      title: 'Aaj kya banao? 🍳',
      body: 'Chef Arti intezaar kar rahi hai!',
      url: '/home',
    });
  }

  return NextResponse.json({ ok: true, nudged: activeUserIds.length, delivered });
}
