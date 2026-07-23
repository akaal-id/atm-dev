import Link from "next/link";
import { History, Mail, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Empty state when no email blast history exists yet. */
export function EmailBlastHistoryEmpty() {
  return (
    <div className="rounded-[2px] border border-dashed border-border bg-muted/60 p-8 text-center sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <History className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-normal text-foreground">Belum ada riwayat pengiriman</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
        Setelah kamu mengirim email blast, semua kiriman akan muncul di sini beserta status penerima.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10")}>
          <Plus className="h-4 w-4" />
          Buat email blast
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Compose → kirim → muncul di riwayat
        </span>
      </div>
    </div>
  );
}
