import Link from "next/link";
import { History, Mail, Plus } from "lucide-react";
import styles from "./email-blast-history-empty.module.css";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Empty state when no email blast history exists yet. */
export function EmailBlastHistoryEmpty() {
  return (
    <div className={styles.emailblasthistoryempty}>
      <div className={styles.emptystate}>
        <History className={styles.history} aria-hidden />
      </div>
      <p className={styles.emptyText}>Belum ada riwayat pengiriman</p>
      <p className={styles.emptytextEmailblasthistoryempty}>
        Setelah kamu mengirim email blast, semua kiriman akan muncul di sini beserta status penerima.
      </p>
      <div className={styles.emptystateDiv}>
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), styles.item)}>
          <Plus className={styles.icon} />
          Buat email blast
        </Link>
        <span className={styles.meta}>
          <Mail className={styles.iconMail} aria-hidden />
          Compose → kirim → muncul di riwayat
        </span>
      </div>
    </div>
  );
}
