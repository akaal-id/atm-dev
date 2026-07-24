"use client";

import { Check, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { buildTenantPath } from "@/lib/tenant-path";
import styles from "./billing-paywall.module.css";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("id-ID")}`;
  }
}

type BillingPaywallProps = {
  companyId: string;
  organizationId: string;
  companyName: string;
  organizationName: string;
  plan: string;
  interval: string;
  price: number;
  currency: string;
  billingStatus: string;
};

export function BillingPaywall({
  companyId,
  organizationId,
  companyName,
  organizationName,
  plan,
  interval,
  price,
  currency,
  billingStatus,
}: BillingPaywallProps) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function simulatePay() {
    if (paying) return;
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/billing/simulate-payment", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Payment failed");

      router.replace(buildTenantPath({ orgId: organizationId, companyId, path: "/dashboard" }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coba lagi.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <p className={styles.label}>Organization</p>
          <p className={styles.value}>{organizationName}</p>
        </div>
        <div>
          <p className={styles.label}>Company</p>
          <p className={styles.value}>{companyName}</p>
        </div>
        <div>
          <p className={styles.label}>Status</p>
          <p className={styles.badge}>{billingStatus.replaceAll("_", " ")}</p>
        </div>
      </div>

      <div className={styles.plan}>
        <div className={styles.planHead}>
          <Shield className={styles.planIcon} aria-hidden />
          <div>
            <p className={styles.planName}>
              {plan || "starter"} · {interval || "monthly"}
            </p>
            <p className={styles.price}>{formatMoney(price, currency)}</p>
          </div>
        </div>
        <ul className={styles.features}>
          <li>
            <Check className={styles.check} aria-hidden /> Dashboard ERP Akaal Team
          </li>
          <li>
            <Check className={styles.check} aria-hidden /> Tasks, attendance, HR, announcements
          </li>
          <li>
            <Check className={styles.check} aria-hidden /> Multi-company di dalam organisasi kamu
          </li>
          <li>
            <Check className={styles.check} aria-hidden /> Status verified setelah bayar
          </li>
        </ul>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Button type="button" size="lg" className={styles.payButton} disabled={paying} onClick={() => void simulatePay()}>
        {paying ? (
          <>
            <Loader2 className={styles.spin} aria-hidden /> Memproses…
          </>
        ) : (
          "Simulasikan bayar bulanan"
        )}
      </Button>
      <p className={styles.note}>
        Tidak ada charge sungguhan. Tombol ini hanya men-set `is_verified` + `billing_status=active`.
      </p>
    </div>
  );
}
