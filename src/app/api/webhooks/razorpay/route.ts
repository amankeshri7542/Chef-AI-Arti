import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// This route is intentionally public — no Clerk auth.
// It's in the public routes list in proxy.ts.

export async function POST(req: NextRequest) {
  // 1. Signature verification — must do this first
  const signature = req.headers.get('x-razorpay-signature');
  const body = await req.text();
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body) as {
    event: string;
    payload: {
      subscription: {
        entity: {
          id: string;
          notes?: { user_id?: string; clerk_user_id?: string };
        };
      };
      payment?: {
        entity: {
          amount?: number;
        };
      };
    };
  };

  const sub = event.payload.subscription.entity;
  const subId = sub.id;
  const userId = sub.notes?.user_id;

  const supabase = createServerClient();

  try {
    switch (event.event) {
      case 'subscription.activated': {
        // Update user subscription status
        const updateQuery = supabase
          .from('users')
          .update({
            subscription_status: 'paid',
            subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            razorpay_sub_id: subId,
          });

        if (userId) {
          await updateQuery.eq('id', userId);
        } else {
          await updateQuery.eq('razorpay_sub_id', subId);
        }

        // Insert subscription record
        if (userId) {
          await supabase.from('subscriptions').insert({
            user_id: userId,
            razorpay_sub_id: subId,
            plan: 'monthly',
            amount_paise: 15000,
            status: 'active',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
        break;
      }

      case 'subscription.charged': {
        // Extend ends_at by 1 month
        const newEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('users')
          .update({ subscription_ends_at: newEndsAt })
          .eq('razorpay_sub_id', subId);

        await supabase
          .from('subscriptions')
          .update({ status: 'active', ends_at: newEndsAt })
          .eq('razorpay_sub_id', subId);
        break;
      }

      case 'subscription.cancelled': {
        // Mark subscription cancelled but keep user as paid until ends_at
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('razorpay_sub_id', subId);
        // user.subscription_status stays 'paid' until ends_at expires
        break;
      }

      case 'subscription.expired': {
        // Downgrade user to free
        await supabase
          .from('users')
          .update({ subscription_status: 'free', subscription_ends_at: null })
          .eq('razorpay_sub_id', subId);

        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('razorpay_sub_id', subId);
        break;
      }

      default:
        // Unknown event — log and return 200 so Razorpay doesn't retry
        break;
    }
  } catch (err) {
    console.error('[razorpay-webhook] Error processing event:', event.event, err);
    // Still return 200 to prevent Razorpay from retrying indefinitely
  }

  // Always return 200 (Razorpay retries on non-200)
  return NextResponse.json({ received: true });
}
