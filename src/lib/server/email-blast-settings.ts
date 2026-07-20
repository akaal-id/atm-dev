import "server-only";

function supabaseUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (explicitUrl || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function headers() {
  const key = supabaseKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export type SenderProfile = {
  user_id: string;
  sender_name: string;
  updated_at: string;
  created_at: string;
};

export async function getSenderProfile(userId: string): Promise<SenderProfile | null> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const response = await fetch(
    `${baseUrl}/rest/v1/email_blast_sender_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as SenderProfile[];
  return rows[0] ?? null;
}

export async function upsertSenderProfile(userId: string, senderName: string): Promise<SenderProfile> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const record = {
    user_id: userId,
    sender_name: senderName.trim(),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const response = await fetch(`${baseUrl}/rest/v1/email_blast_sender_profiles`, {
    method: "POST",
    headers: {
      ...headers(),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error(`Failed to save sender profile (${response.status})`);
  }

  const rows = (await response.json()) as SenderProfile[];
  return rows[0] ?? record;
}
