import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase';
import { chatCompletion, CHAT_MODEL } from '@/lib/openai';
import {
  checkRateLimit,
  getRateLimitRemaining,
  getChatSession,
  setChatSession,
  compressAndUpdateSession,
  RATE_LIMITS,
} from '@/lib/redis';
import { searchKnowledge, hasSafetyFlag } from '@/lib/knowledge';
import type { ChatSession, ChatMessage } from '@/types/index';

interface MessageBody {
  message: string;
  recipeId?: string;
  recipeName?: string;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { message, recipeId, recipeName }: MessageBody = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  // Chat opened from home has no recipe context. Treat empty/'general' as no recipe.
  const hasRecipeContext = Boolean(recipeName && recipeName !== 'general');

  // 2. Get user context from Supabase (needed for rate-limit bypass + chat context)
  const supabase = createServerClient();
  const { data: user } = await supabase
    .from('users')
    .select('diet_type, family_size, is_vrat_mode, spice_preference, subscription_status')
    .eq('clerk_user_id', userId)
    .single<{
      diet_type: string;
      family_size: number;
      is_vrat_mode: boolean;
      spice_preference: string;
      subscription_status: string;
    }>();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // 3. Rate limit — tiered by subscription status
  const subStatus = (user.subscription_status === 'paid' ? 'paid' : 'free') as 'free' | 'paid';
  const allowed = await checkRateLimit(userId, 'chat', subStatus);
  if (!allowed) {
    const limit = RATE_LIMITS[subStatus].chat;
    return NextResponse.json(
      {
        error: `Aaj ke ${limit} sawaal ho gaye! ${
          subStatus === 'free'
            ? '₹150/mein 20 sawaal roz poochho 😊'
            : 'Kal phir aana!'
        }`,
        limitReached: true,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  // 4. Load or create session
  let session: ChatSession = (await getChatSession(userId)) ?? {
    compressed_memory: {
      current_recipe: hasRecipeContext ? recipeName! : null,
      family_size: user.family_size,
      cooking_progress: '',
      notes: '',
    },
    recent_messages: [],
  };

  // 5. Load and fill system prompt
  const rawPrompt = fs.readFileSync(
    path.join(process.cwd(), 'scripts/seed/system-prompt.txt'),
    'utf-8',
  );

  // 6. Parallel RAG retrieval
  const [knowledgeDocs, recipeRow] = await Promise.all([
    searchKnowledge(message, {
      currentRecipe: session.compressed_memory.current_recipe ?? undefined,
      appliesTo: [],
    }).catch(() => []),
    recipeId
      ? (async () => {
          try {
            const { data } = await supabase
              .from('recipes')
              .select('name_hinglish, description, steps')
              .eq('id', recipeId)
              .single<{ name_hinglish: string; description: string | null; steps: Array<{ instruction: string }> }>();
            return data ?? null;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
  ]);

  const retrievedKnowledge = knowledgeDocs.length > 0
    ? knowledgeDocs.map((d) => d.content).join('\n---\n')
    : '';

  const retrievedRecipe = recipeRow
    ? `${recipeRow.name_hinglish}: ${recipeRow.description ?? ''}\nSteps: ${
        (recipeRow.steps as Array<{ instruction: string }> ?? [])
          .slice(0, 3)
          .map((s, i) => `${i + 1}. ${s.instruction}`)
          .join(' ')
      }`
    : '';

  // Fill placeholders
  let filledPrompt = rawPrompt
    .replace('{diet_type}', user.diet_type)
    .replace('{family_size}', user.family_size.toString())
    .replace('{is_vrat_mode}', user.is_vrat_mode.toString())
    .replace('{spice_pref}', user.spice_preference ?? 'medium')
    .replace('{current_recipe}', session.compressed_memory.current_recipe ?? 'Koi specific recipe nahi — general baat-cheet')
    .replace('{cooking_progress}', session.compressed_memory.cooking_progress ?? '')
    .replace('{retrieved_recipe}', retrievedRecipe)
    .replace('{retrieved_knowledge}', retrievedKnowledge);

  // 7. Safety flag check
  if (hasSafetyFlag(knowledgeDocs)) {
    filledPrompt +=
      '\nSAFETY NOTE: If user asks about health or medical claims, redirect gently. Never make disease cure claims.';
  }

  // 8. Build messages array
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: filledPrompt },
    {
      role: 'system',
      content: `Context: ${JSON.stringify(session.compressed_memory)}`,
    },
    ...session.recent_messages.slice(-5).map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // 9. GPT call
  let reply: string;
  try {
    reply = await chatCompletion(messages, CHAT_MODEL);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[chat/message] 500 error:', errMsg);
    if (err && typeof err === 'object' && 'status' in err) {
      console.error('[chat/message] OpenAI error status:', (err as { status: number }).status);
    }
    return NextResponse.json(
      { error: 'Arti thodi thak gayi! Thodi der mein try karo 😅' },
      { status: 500 },
    );
  }

  // 10. Update session
  const updatedMessages: ChatMessage[] = [
    ...session.recent_messages,
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ];

  if (updatedMessages.length > 0 && updatedMessages.length % 10 === 0) {
    await compressAndUpdateSession(
      userId,
      updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      session.compressed_memory.current_recipe ?? 'general',
      session.compressed_memory.cooking_progress ?? '',
    );
  } else {
    await setChatSession(userId, {
      compressed_memory: session.compressed_memory,
      recent_messages: updatedMessages.slice(-5),
    });
  }

  // 11. Remaining count
  const remaining = await getRateLimitRemaining(userId, 'chat', subStatus);

  // 12. Return
  return NextResponse.json({ reply, remaining, sessionExists: true });
}
