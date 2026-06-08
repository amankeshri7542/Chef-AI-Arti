import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import BachaHuaClient from './BachaHuaClient';

export default async function BachaHuaPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from('users')
    .select('subscription_status, name')
    .eq('clerk_user_id', userId)
    .single();

  const isPaid =
    (user as { subscription_status?: string } | null)?.subscription_status ===
    'paid';

  return (
    <main>
      <BachaHuaClient isPaid={isPaid} />
    </main>
  );
}
