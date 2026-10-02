/**
 * Dev / benchmark aid: with PERF_TRACE=1, log every server-side fetch (mostly
 * Supabase REST) with its start offset and duration, to find request waterfalls.
 * Off by default; no effect in normal runs.
 */
export function register() {
  if (process.env.PERF_TRACE !== "1" || process.env.NEXT_RUNTIME !== "nodejs") return;

  const original = globalThis.fetch;
  const origin = Date.now();
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const started = Date.now();
    try {
      return await original(input, init);
    } finally {
      const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/(select=)[^&]{40,}/, "$1…").slice(0, 140);
      console.log(`[perf] +${String(started - origin).padStart(7)}ms ${String(Date.now() - started).padStart(5)}ms ${init?.method ?? "GET"} ${path}`);
    }
  };
}
