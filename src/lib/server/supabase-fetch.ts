import "server-only";

import { revalidateTag } from "next/cache";

/**
 * The single door to Supabase PostgREST. Every server helper calls this instead of `fetch`:
 *
 * - Reads (GET/HEAD on `/rest/v1/<table>`) go through Next's data cache, tagged
 *   `sb:<table>`, so repeat page loads don't make another round trip to Supabase.
 * - Writes (POST/PATCH/PUT/DELETE on a table) expire that table's tag immediately,
 *   so the next read anywhere sees the change (read-your-writes).
 * - RPC calls, Storage, Auth, and any non-Supabase URL pass straight through.
 *
 * Writes made outside this app (e.g. the Supabase dashboard) show up within READ_TTL.
 */
const READ_TTL_SECONDS = 300;

const TABLE_PATTERN = /\/rest\/v1\/([a-z0-9_]+)/i;

export function tableTag(table: string) {
  return `sb:${table}`;
}

function tableOf(url: string) {
  const table = TABLE_PATTERN.exec(url)?.[1];
  return table && table !== "rpc" ? table : null;
}

/** Expire cached reads of these tables (no-op outside a request scope that allows it). */
export function invalidateTables(...tables: string[]) {
  for (const table of new Set(tables)) {
    try {
      revalidateTag(tableTag(table), { expire: 0 });
    } catch {
      // Called during render or outside a request (e.g. scripts): nothing cached to expire there.
    }
  }
}

export async function supabaseFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const table = tableOf(input);
  const method = (init.method ?? "GET").toUpperCase();
  if (!table) return fetch(input, init);

  if (method === "GET" || method === "HEAD") {
    // Drop the callers' `cache: "no-store"`; caching is decided here.
    const { cache: _cache, ...rest } = init;
    void _cache;
    return fetch(input, { ...rest, next: { revalidate: READ_TTL_SECONDS, tags: [tableTag(table)] } });
  }

  const response = await fetch(input, { ...init, cache: "no-store" });
  if (response.ok) invalidateTables(table);
  return response;
}
