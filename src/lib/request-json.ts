/** Client JSON request that throws the API's `{ error }` message on failure. */
export async function requestJson<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as { data?: T } | null;
  return payload?.data as T;
}
