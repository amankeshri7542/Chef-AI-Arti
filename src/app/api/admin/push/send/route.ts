import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';

// POST — bulk push to All / Free / Paid users who have push subscriptions.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, body, target } = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    target?: 'all' | 'free' | 'paid';
  };

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  }
  if (title.length > 50 || body.length > 200) {
    return NextResponse.json({ error: 'title max 50, body max 200 chars' }, { status: 400 });
  }
  const tgt = target === 'free' || target === 'paid' ? target : 'all';

  const supabase = createServerClient();

  // Users who actually have a push subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id');
  const subscribedIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];

  if (subscribedIds.length === 0) {
    return NextResponse.json({ sent: 0, note: 'No push subscriptions' });
  }

  let query = supabase.from('users').select('id').in('id', subscribedIds);
  if (tgt !== 'all') {
    query = query.eq('subscription_status', tgt);
  }
  const { data: users } = await query;

  let sent = 0;
  for (const u of users ?? []) {
    try {
      const delivered = await sendPushToUser(u.id as string, {
        title: title.trim(),
        body: body.trim(),
        url: '/home',
      });
      if (delivered > 0) sent += 1;
    } catch (err) {
      console.error('[admin-push] send failed for user', u.id, (err as Error).message);
    }
  }

  await supabase.from('push_logs').insert({
    title: title.trim(),
    body: body.trim(),
    target: tgt,
    sent_count: sent,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ sent });
}
