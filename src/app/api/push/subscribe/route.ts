import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karein pehle' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Resolve internal user UUID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single<{ id: string }>();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Galat data' }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Subscription adhoori hai' }, { status: 400 });
  }

  // Upsert on user_id (one device-subscription per user; latest wins).
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth: authKey },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: 'Save nahi ho saka' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
