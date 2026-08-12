"use client";

import styles from "./email-blast-group-members-table.module.css";

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
    <div className={styles.actions}>
      <table className={styles.table}>
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header}
                className={styles.headercell}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className={styles.item}>
              <td className={styles.cell}>
                <p className={styles.text}>{contact.fullName || "—"}</p>
              </td>
              <td className={styles.tableCell}>
                <span className={styles.breakall}>{contact.email}</span>
              </td>
              <td className={styles.tableCell}>
                {contact.company || "—"}
              </td>
              <td className={styles.cell}>
                <EmailBlastVerificationBadge
                  status={contact.verificationStatus || "unchecked"}
                  detail={contact.verificationDetail}
                />
              </td>
              <td className={styles.cell}>
                <div className={styles.group}>
                  {onVerify ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={styles.button}
                      aria-label={`Cek ${contact.email}`}
                      disabled={busy}
                      title="Cek email ini"
                      onClick={() => onVerify(contact.id)}
                    >
                      <ShieldCheck className={styles.icon} />
                    </Button>
                  ) : null}
                  {onRemove ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={styles.control}
                      aria-label={`Hapus ${contact.email}`}
                      disabled={busy}
                      onClick={() => onRemove(contact.id)}
                    >
                      <X className={styles.icon} />
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
