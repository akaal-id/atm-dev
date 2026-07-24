/** URL tenant helpers — `/org/[orgId]/c/[companyId]/...` */

export const TENANT_ALL = "all";

/** Cookie value for "all companies" scope (must stay in sync with company-context). */
export const ALL_COMPANIES_COOKIE = "__all__";

export const DEFAULT_ORG_ID = "org_akaal";
export const DEFAULT_COMPANY_ID = "cmp_akaal";

export const activeOrganizationCookieName = "active_organization_id";
export const activeCompanyCookieName = "active_company_id";

export type TenantRef = {
  orgId: string;
  companyId: string;
};

export type ParsedTenantPath = TenantRef & {
  /** App path after tenant prefix, always starts with `/` (e.g. `/dashboard`). */
  rest: string;
};

const TENANT_PATH_RE = /^\/org\/([^/]+)\/c\/([^/]+)(\/.*)?$/;

export function companyIdToCookie(companyId: string) {
  return companyId === TENANT_ALL ? ALL_COMPANIES_COOKIE : companyId;
}

export function cookieToCompanyId(cookieValue: string | null | undefined) {
  const value = String(cookieValue ?? "").trim();
  if (!value || value === ALL_COMPANIES_COOKIE) return TENANT_ALL;
  return value;
}

export function normalizeAppPath(path: string) {
  const trimmed = path.trim() || "/";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed;
}

/** Build `/org/{orgId}/c/{companyId}{path}`. */
export function buildTenantPath(input: {
  orgId: string;
  companyId: string;
  path?: string;
}) {
  const orgId = encodeURIComponent(input.orgId || DEFAULT_ORG_ID);
  const companyId = encodeURIComponent(input.companyId || DEFAULT_COMPANY_ID);
  const rest = normalizeAppPath(input.path ?? "/dashboard");
  return `/org/${orgId}/c/${companyId}${rest === "/" ? "/dashboard" : rest}`;
}

export function parseTenantPath(pathname: string): ParsedTenantPath | null {
  const match = pathname.match(TENANT_PATH_RE);
  if (!match) return null;
  const orgId = decodeURIComponent(match[1] || "");
  const companyId = decodeURIComponent(match[2] || "");
  const restRaw = match[3] || "/dashboard";
  const rest = normalizeAppPath(restRaw);
  if (!orgId || !companyId) return null;
  return { orgId, companyId, rest: rest === "/" ? "/dashboard" : rest };
}

export function stripTenantPrefix(pathname: string) {
  const parsed = parseTenantPath(pathname);
  return parsed?.rest ?? normalizeAppPath(pathname);
}

/** Pathname used for nav active state (tenant prefix stripped). */
export function appPathname(pathname: string) {
  return stripTenantPrefix(pathname);
}

export function isTenantPath(pathname: string) {
  return TENANT_PATH_RE.test(pathname);
}

/** Prefix a workspace-relative href with the current tenant. */
export function withTenant(href: string, tenant: TenantRef | null | undefined) {
  const path = normalizeAppPath(href);
  if (!tenant?.orgId || !tenant?.companyId) return path;
  if (isTenantPath(path)) return path;
  return buildTenantPath({ orgId: tenant.orgId, companyId: tenant.companyId, path });
}

export function mapNavHref<T extends { href: string; children?: T[] }>(item: T, tenant: TenantRef | null | undefined): T {
  return {
    ...item,
    href: withTenant(item.href, tenant),
    children: item.children?.map((child) => mapNavHref(child, tenant)),
  };
}

export function resolveTenantFromCookies(input: {
  organizationId?: string | null;
  companyId?: string | null;
}) {
  const companyCookie = String(input.companyId ?? "").trim();
  const orgCookie = String(input.organizationId ?? "").trim();

  if (companyCookie === ALL_COMPANIES_COOKIE) {
    return {
      orgId: orgCookie || TENANT_ALL,
      companyId: TENANT_ALL,
    };
  }

  return {
    orgId: orgCookie || DEFAULT_ORG_ID,
    companyId: companyCookie || DEFAULT_COMPANY_ID,
  };
}
