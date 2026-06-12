import { Redis } from '@upstash/redis';
import type { ChatSession, RateLimitAction } from '@/types/index';
import { chatCompletion, SUMMARY_MODEL } from '@/lib/openai';
import type OpenAI from 'openai';
import { RATE_LIMITS } from '@/lib/rate-limits';

export { RATE_LIMITS };

const redis = Redis.fromEnv();

function midnightUnixSeconds(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return Math.floor(midnight.getTime() / 1000);
}

function rateLimitKey(userId: string, action: RateLimitAction): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `rate:${userId}:${action}:${today}`;
}

/**
 * Increment usage counter and return whether the action is allowed.
 * true = allowed (under limit), false = blocked (limit reached).
 * Key expires at midnight UTC — resets cleanly each day.
 */
export async function checkRateLimit(
  userId: string,
  action: RateLimitAction,
  subscriptionStatus: 'free' | 'paid' = 'free',
): Promise<boolean> {
  const key = rateLimitKey(userId, action);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expireat(key, midnightUnixSeconds());
  }
  return count <= RATE_LIMITS[subscriptionStatus][action];
}

/**
 * Returns how many uses remain today for UI display.
 * Returns the full limit if the key doesn't exist yet (no uses today).
 */
export async function getRateLimitRemaining(
  userId: string,
  action: RateLimitAction,
  subscriptionStatus: 'free' | 'paid' = 'free',
): Promise<number> {
  const key = rateLimitKey(userId, action);
  const count = await redis.get<number>(key);
  if (count === null) return RATE_LIMITS[subscriptionStatus][action];
  return Math.max(0, RATE_LIMITS[subscriptionStatus][action] - count);
}

/**
 * Webhook idempotency — record an event id the first time it's seen.
 * Returns true if this id is NEW (caller should process it), false if it was
 * already processed (caller must skip). Uses SET NX so the check + claim is
 * atomic across concurrent retries. Kept 7 days — longer than any Razorpay
 * retry window.
 */
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const res = await redis.set(`webhook:razorpay:${eventId}`, '1', {
    nx: true,
    ex: 7 * 24 * 60 * 60,
  });
  return res === 'OK';
}

/**
 * Brute-force lockout for the admin login. Increments a per-IP counter with a
 * rolling 15-minute window. Returns true when the IP is still allowed (under
 * the cap), false when it should be locked out. Call BEFORE checking the
 * password so wrong guesses are what accrue.
 */
export async function checkAdminLoginAllowed(ip: string): Promise<boolean> {
  const key = `adminlogin:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 15 * 60);
  }
  return count <= 5;
}

/** Clear the admin-login attempt counter for an IP (call on success). */
export async function resetAdminLoginAttempts(ip: string): Promise<void> {
  await redis.del(`adminlogin:${ip}`);
}

// ─────────────────────────────────────
// Chat session memory (ephemeral — Redis only, no Supabase)
// ─────────────────────────────────────

const CHAT_TTL = 10800; // 3 hours in seconds — refreshed on every message

function chatSessionKey(userId: string): string {
  return `chat:${userId}`;
}

/**
 * Load the current chat session from Redis.
 * Returns null if the session has expired or never existed.
 */
export async function getChatSession(userId: string): Promise<ChatSession | null> {
  try {
    const raw = await redis.get<string>(chatSessionKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as ChatSession;
  } catch {
    return null;
  }
}

/**
 * Persist chat session to Redis with a 3-hour TTL (refreshed on every call).
 * Keeps the session alive while the user is actively cooking.
 */
export async function setChatSession(userId: string, session: ChatSession): Promise<void> {
  await redis.set(chatSessionKey(userId), JSON.stringify(session), { ex: CHAT_TTL });
}

/**
 * Delete the chat session (e.g. when user explicitly ends the conversation).
 */
export async function deleteChatSession(userId: string): Promise<void> {
  await redis.del(chatSessionKey(userId));
}

/**
 * Compress the full conversation into a structured memory object and persist.
 * Called after every 5 messages to keep token count flat regardless of conversation length.
 * Stores compressed_memory + the last 5 messages (sliding window context).
 */
export async function compressAndUpdateSession(
  userId: string,
  fullMessages: OpenAI.Chat.ChatCompletionMessageParam[],
  currentRecipe: string,
  cookingProgress: string,
): Promise<void> {
  const compressionPrompt: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are a cooking session summariser. Compress the conversation into a JSON object.',
    },
    ...fullMessages,
    {
      role: 'user',
      content: `Summarize this cooking conversation into a JSON object with these exact fields:
{
  "current_recipe": string (recipe name being cooked, or null),
  "family_size": number or null,
  "cooking_progress": string (where they are in the recipe steps),
  "oil_preference": string or null,
  "notes": string (key facts to remember, max 2 sentences)
}
Reply ONLY with valid JSON. Be concise — max 100 tokens total.`,
    },
  ];

  let compressedMemory: {
    current_recipe: string | null;
    family_size: number;
    cooking_progress: string;
    oil_preference?: string;
    notes: string;
  } = {
    current_recipe: currentRecipe,
    family_size: 4,
    cooking_progress: cookingProgress,
    notes: '',
  };

  try {
    const raw = await chatCompletion(compressionPrompt, SUMMARY_MODEL);
    const parsed = JSON.parse(raw.trim()) as typeof compressedMemory;
    compressedMemory = { ...compressedMemory, ...parsed };
  } catch {
    // compression failed — keep the defaults built from params
  }

  const recentMessages = fullMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-5)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
    }));

  const session: ChatSession = {
    compressed_memory: compressedMemory,
    recent_messages: recentMessages,
  };

  await setChatSession(userId, session);
}
