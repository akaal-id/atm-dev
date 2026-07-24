import {
  DEFAULT_COMPANY_ID,
  DEFAULT_ORG_ID,
  activeCompanyCookieName,
  activeOrganizationCookieName,
  isTenantPath,
  parseTenantPath,
  resolveTenantFromCookies,
} from "@/lib/tenant-path";

/** Workspace paths that require an authenticated session cookie (legacy + tenant). */
export const protectedRoutePrefixes = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/workflows",
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
  "/project-files",
  "/org",
  "/tenant-access-denied",
] as const;

export function isProtectedPath(pathname: string) {
  if (isTenantPath(pathname)) return true;
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Legacy workspace paths that should redirect into `/org/.../c/...`. */
export function isLegacyWorkspacePath(pathname: string) {
  if (isTenantPath(pathname)) return false;
  if (pathname === "/invite") return false;
  if (pathname === "/tenant-access-denied") return false;
  return protectedRoutePrefixes.some(
    (prefix) =>
      prefix !== "/org" &&
      prefix !== "/tenant-access-denied" &&
      (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

export function tenantFromRequestCookies(cookies: {
  get: (name: string) => { value: string } | undefined;
}) {
  return resolveTenantFromCookies({
    organizationId: cookies.get(activeOrganizationCookieName)?.value,
    companyId: cookies.get(activeCompanyCookieName)?.value,
  });
}

export { DEFAULT_COMPANY_ID, DEFAULT_ORG_ID, parseTenantPath };
