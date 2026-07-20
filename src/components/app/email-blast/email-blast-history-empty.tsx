import Link from "next/link";
import { History, Mail, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Empty state when no email blast history exists yet. */
export function EmailBlastHistoryEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <History className="h-5 w-5 text-slate-400" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800">Belum ada riwayat pengiriman</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
        Setelah kamu mengirim email blast, semua kiriman akan muncul di sini beserta status penerima.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10")}>
          <Plus className="h-4 w-4" />
          Buat email blast
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Compose → kirim → muncul di riwayat
        </span>
      </div>
    </div>
  );
}
