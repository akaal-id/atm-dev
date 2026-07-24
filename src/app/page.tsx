import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HubPage } from "@/components/hub/hub-page";
import { akaalHub } from "@/lib/data/akaal-hub";
import { getSession } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { buildTenantPath, DEFAULT_COMPANY_ID, DEFAULT_ORG_ID } from "@/lib/tenant-path";

export const metadata: Metadata = {
  title: "AKAAL",
  description: akaalHub.brand.tagline,
  openGraph: {
    title: "AKAAL",
    description: akaalHub.brand.tagline,
    url: "https://team.akaal.id",
    siteName: "AKAAL",
    type: "website",
  },
};

export default async function Home() {
  const session = await getSession();
  if (session) {
    try {
      const context = await getActiveCompanyContext(session.userId);
      redirect(
        buildTenantPath({
          orgId: context.organization?.id || context.company.organization_id || DEFAULT_ORG_ID,
          companyId: context.company.id || DEFAULT_COMPANY_ID,
          path: "/dashboard",
        }),
      );
    } catch {
      redirect(buildTenantPath({ orgId: DEFAULT_ORG_ID, companyId: DEFAULT_COMPANY_ID, path: "/dashboard" }));
    }
  }

  return <HubPage />;
}
