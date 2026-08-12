import "server-only";

export function getSupabaseUrl() {
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");
  const projectId = process.env.SUPABASE_PROJECT_ID;
  return projectId ? `https://${projectId}.supabase.co` : "";
}

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function isSupabaseRestConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey());
}

function isOpaqueApiKey(key: string) {
  return key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
}

/**
 * Auth headers for server-side Supabase REST / Storage.
 * New opaque keys (`sb_secret_` / `sb_publishable_`) must go on `apikey` only —
 * putting them in `Authorization: Bearer` makes PostgREST try to parse them as JWTs
 * (Invalid JWT / PGRST303 "JWT issued at future").
 */
export function supabaseAuthHeaders(key = getSupabaseSecretKey()): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    // Prevent gateway "secret key in browser" 401 if a browser User-Agent is forwarded.
    "User-Agent": "atm-erp-server",
  };

  if (!isOpaqueApiKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

export function applySupabaseAuthHeaders(headers: Headers, key = getSupabaseSecretKey()) {
  for (const [name, value] of Object.entries(supabaseAuthHeaders(key))) {
    headers.set(name, value);
  }
}

export function isJwtIssuedAtFutureError(status: number, preview: string) {
  return status === 401 && preview.includes("PGRST303");
}
