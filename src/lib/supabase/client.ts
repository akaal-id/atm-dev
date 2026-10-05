import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client, used only for Realtime (ATM's auth is its own cookie, not Supabase Auth).
 *
 * One shared instance = one websocket for every subscription. The publishable key is set on the
 * realtime connection synchronously: the previous `@supabase/ssr` client resolved its token
 * asynchronously, so a channel created right away joined *without* a token and silently never
 * received postgres_changes events (messages only showed after a page refresh).
 */
export function createClient() {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  client = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  void client.realtime.setAuth(key);
  return client;
}
