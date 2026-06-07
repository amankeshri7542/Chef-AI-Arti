import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (service role key).
 * Use in API routes, server actions, seed scripts.
 * Bypasses RLS — only use in trusted server code, never expose to the browser.
 * Returns a new instance each call for Next.js edge/serverless compat.
 */
export function createServerClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Browser-side Supabase client (anon key).
 * Use in Client Components only. Respects Row Level Security policies.
 * Returns a new instance each call — memoize in component state if needed.
 */
export function createBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
