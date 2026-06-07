import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getChatSession, deleteChatSession } from '@/lib/redis';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const session = await getChatSession(userId);
  if (!session) return NextResponse.json({ session: null, exists: false });
  return NextResponse.json({ session, exists: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await deleteChatSession(userId);
  return NextResponse.json({ cleared: true });
}
