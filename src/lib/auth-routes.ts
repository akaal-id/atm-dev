/** Workspace paths that require an authenticated session cookie. */
export const protectedRoutePrefixes = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/calendar",
  "/attendance",
  "/announcements",
  "/email-blast",
  "/employees",
  "/leaderboard",
  "/notifications",
  "/chat",
  "/admin",
  "/invite",
] as const;

export function isProtectedPath(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
