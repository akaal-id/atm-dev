import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { buildTenantPath, TENANT_ALL } from "@/lib/tenant-path";
import styles from "./tenant-access-denied.module.css";

export default async function TenantAccessDeniedPage() {
  const user = await requireUser();
  const context = await getActiveCompanyContext(user.user_id);

  const homeHref = buildTenantPath({
    orgId:
      user.role_id === "super_admin"
        ? TENANT_ALL
        : context.organization?.id || context.company.organization_id,
    companyId: user.role_id === "super_admin" ? TENANT_ALL : context.company.id,
    path: "/dashboard",
  });

  // Super admin should not land here for normal deep-links; send them home.
  if (user.role_id === "super_admin") {
    redirect(homeHref);
  }

  const orgName = context.organization?.name || context.company.name || "organisasi Anda";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.badge}>Akses ditolak</span>
        <h1 className={styles.title}>Anda tidak memiliki akses</h1>
        <p className={styles.text}>
          Anda tidak memiliki akses untuk masuk ke organisasi ini. Silakan kembali ke organisasi Anda
          ({orgName}).
        </p>
        <div className={styles.actions}>
          <Link href={homeHref} className={styles.link}>
            Kembali ke organisasi Anda
          </Link>
        </div>
      </section>
    </main>
  );
}
