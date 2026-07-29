"use client";

import { ShieldCheck, X } from "lucide-react";

import { EmailBlastVerificationBadge } from "@/components/app/email-blast/email-blast-verification-badge";
import { Button } from "@/components/ui/button";
import type { MockContact } from "@/lib/data/email-blast-contacts-mock";

const HEADERS = ["Nama", "Email", "Company", "Status", "Aksi"] as const;

interface EmailBlastGroupMembersTableProps {
  contacts: MockContact[];
  busy?: boolean;
  onVerify?: (contactId: string) => void;
  onRemove?: (contactId: string) => void;
}

/** Table of group members with verification status and row actions. */
export function EmailBlastGroupMembersTable({
  contacts,
  busy = false,
  onVerify,
  onRemove,
}: EmailBlastGroupMembersTableProps) {
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header}
                className="border-b border-border px-3 py-3 font-normal text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="transition hover:bg-surface-inset/80">
              <td className="border-b border-border px-3 py-3 align-middle">
                <p className="font-normal text-foreground">{contact.fullName || "—"}</p>
              </td>
              <td className="border-b border-border px-3 py-3 align-middle text-muted-foreground">
                <span className="break-all">{contact.email}</span>
              </td>
              <td className="border-b border-border px-3 py-3 align-middle text-muted-foreground">
                {contact.company || "—"}
              </td>
              <td className="border-b border-border px-3 py-3 align-middle">
                <EmailBlastVerificationBadge
                  status={contact.verificationStatus || "unchecked"}
                  detail={contact.verificationDetail}
                />
              </td>
              <td className="border-b border-border px-3 py-3 align-middle">
                <div className="flex items-center gap-1">
                  {onVerify ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Cek ${contact.email}`}
                      disabled={busy}
                      title="Cek email ini"
                      onClick={() => onVerify(contact.id)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {onRemove ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-red-600"
                      aria-label={`Hapus ${contact.email}`}
                      disabled={busy}
                      onClick={() => onRemove(contact.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
