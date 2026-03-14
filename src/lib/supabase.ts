import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser / client-components: anon key, no user context */
export const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * Server-side (API routes): create a client that carries the user's JWT so
 * Row Level Security (auth.uid()) works correctly.
 *
 * Usage:
 *   const sb = serverClient(accessToken);
 *   const { data } = await sb.from('watchlist_items').select('*');
 */
export function serverClient(accessToken: string | null | undefined): SupabaseClient {
  if (!accessToken) return supabase;
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
