import webpush from 'web-push';
import { createServerClient } from '@/lib/supabase';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? 'mailto:admin@arti.amankeshri.com';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY');
  }
  webpush.setVapidDetails(email, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface PushSubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a push to every subscription stored for a given internal user id (UUID).
 * Removes subscriptions that the push service reports as gone (404/410).
 * Returns the number of pushes successfully delivered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  ensureConfigured();
  const supabase = createServerClient();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return 0;

  let delivered = 0;
  await Promise.all(
    (subs as PushSubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        delivered += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead — clean it up.
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('[push] sendNotification failed:', statusCode, (err as Error).message);
        }
      }
    }),
  );

  return delivered;
}
