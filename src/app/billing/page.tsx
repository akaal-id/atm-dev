import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BillingPaywall } from "@/components/app/billing-paywall";
import { getCurrentUser } from "@/lib/server/auth";
import {
  companyHasErpAccess,
  DEFAULT_MONTHLY_PRICE_CENTS,
  getActiveCompanyContext,
} from "@/lib/server/company-context";
import { buildTenantPath, DEFAULT_COMPANY_ID, DEFAULT_ORG_ID } from "@/lib/tenant-path";
import styles from "./billing.module.css";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/billing");

  const context = await getActiveCompanyContext(user.user_id);
  const company = context.company;
  const orgId = context.organization?.id || company.organization_id || DEFAULT_ORG_ID;
  const unlocked = companyHasErpAccess(company) || user.role_id === "super_admin";

  if (unlocked) {
    redirect(buildTenantPath({ orgId, companyId: company.id || DEFAULT_COMPANY_ID, path: "/dashboard" }));
  }

  const price = company.monthly_price_cents ?? DEFAULT_MONTHLY_PRICE_CENTS;
  const currency = company.currency || "IDR";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Image
          src="/icon/mono-akaal-white.png"
          alt="Akaal"
          width={36}
          height={36}
          className={styles.logoMark}
          priority
        />
        <p className={styles.eyebrow}>Subscription</p>
        <h1 className={styles.title}>Aktifkan akses ERP Akaal Team</h1>
        <p className={styles.text}>
          Organisasi mendaftarkan perusahaan → bayar bulanan → status <strong>verified</strong> → dashboard terbuka.
          Ini paywall dummy untuk alur monetisasi (belum terhubung payment gateway).
        </p>

        <BillingPaywall
          companyId={company.id}
          organizationId={orgId}
          companyName={company.name}
          organizationName={context.organization?.name || "Organization"}
          plan={String(company.subscription_plan || "starter")}
          interval={String(company.subscription_interval || "monthly")}
          price={price}
          currency={currency}
          billingStatus={String(company.billing_status || "pending_payment")}
        />

        <p className={styles.footer}>
          Signed in as {user.full_name}. <Link href="/login">Switch account</Link>
        </p>
      </section>
    </main>
  );
}
