import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';
const hasPlaceholderConfig =
  supabaseUrl === 'https://placeholder.supabase.co' ||
  supabaseAnon === 'placeholder-anon-key';

/** Browser / client-components: anon key, no user context */
export const supabase = createClient(supabaseUrl, supabaseAnon);

export function getSupabaseConfigIssue(): string | null {
  if (hasPlaceholderConfig) {
    return 'Supabase yapılandırması eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini ayarlayın.';
  }
  return null;
}

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
