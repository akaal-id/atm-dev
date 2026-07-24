"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  DEFAULT_COMPANY_ID,
  DEFAULT_ORG_ID,
  parseTenantPath,
  type TenantRef,
  withTenant,
} from "@/lib/tenant-path";

type TenantContextValue = TenantRef & {
  rest: string;
  href: (path: string) => string;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  children,
  orgId,
  companyId,
}: {
  children: React.ReactNode;
  orgId?: string;
  companyId?: string;
}) {
  const pathname = usePathname();
  const value = useMemo(() => {
    const parsed = parseTenantPath(pathname);
    const resolvedOrg = parsed?.orgId || orgId || DEFAULT_ORG_ID;
    const resolvedCompany = parsed?.companyId || companyId || DEFAULT_COMPANY_ID;
    const rest = parsed?.rest || pathname || "/dashboard";
    const tenant = { orgId: resolvedOrg, companyId: resolvedCompany };
    return {
      ...tenant,
      rest,
      href: (path: string) => withTenant(path, tenant),
    };
  }, [pathname, orgId, companyId]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return {
      orgId: DEFAULT_ORG_ID,
      companyId: DEFAULT_COMPANY_ID,
      rest: "/dashboard",
      href: (path: string) => path,
    } satisfies TenantContextValue;
  }
  return ctx;
}
