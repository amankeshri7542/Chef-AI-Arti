import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

// PATCH — toggle subscription_status (free <-> paid)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    subscription_status?: 'free' | 'paid';
  };

  if (body.subscription_status !== 'free' && body.subscription_status !== 'paid') {
    return NextResponse.json(
      { error: 'subscription_status must be free or paid' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('users')
    .update({ subscription_status: body.subscription_status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, subscription_status: body.subscription_status });
}
