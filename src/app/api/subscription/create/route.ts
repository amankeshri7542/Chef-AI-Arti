import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST() {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  // 2. Get user from Supabase
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, subscription_status')
    .eq('clerk_user_id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 3. Already paid check
  if (user.subscription_status === 'paid') {
    return NextResponse.json(
      { error: 'Aap already premium member hain! 🎉' },
      { status: 400 },
    );
  }

  // 4. Init Razorpay
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  // 5. Create subscription
  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID!,
    customer_notify: 1,
    quantity: 1,
    total_count: 12,
    notes: { user_id: user.id, clerk_user_id: userId },
  });

  // 6. Return checkout params
  return NextResponse.json({
    subscriptionId: subscription.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: 15000,
    currency: 'INR',
    name: 'Chief-AI-Arti Premium',
    description: 'Unlimited recipes, AI chat, aur bahut kuch!',
  });
}
