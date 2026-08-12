"use client";

import styles from "./email-blast-group-picker.module.css";

import Link from "next/link";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import type { MockContact, MockContactGroup } from "@/lib/data/email-blast-contacts-mock";

interface EmailBlastGroupPickerProps {
  groups: MockContactGroup[];
  onApplyGroup: (contacts: MockContact[]) => void;
}

/** Pick a saved contact group, preview members, then add to recipients. */
export function EmailBlastGroupPicker({ groups, onApplyGroup }: EmailBlastGroupPickerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: group.id,
        label: `${group.groupName} (${group.contacts.length})${
          group.createdBy?.fullName ? ` · ${group.createdBy.fullName}` : ""
        }`,
      })),
    [groups],
  );

  function handleApply() {
    if (!selectedGroup || selectedGroup.contacts.length === 0) return;
    onApplyGroup(selectedGroup.contacts);
  }

  return (
    <div className={styles.emailblastgroup}>
      <div className={styles.group}>
        <div>
          <p className={styles.text}>Pilih grup kontak</p>
          <p className={styles.textP}>
            Pratinjau anggota grup, lalu tambahkan ke daftar penerima.
          </p>
        </div>
        <Link href="/email-blast/contacts" className={styles.link}>
          Kelola grup
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className={styles.emptyText}>
          Belum ada grup. Buat grup di halaman kontak terlebih dahulu.
        </p>
      ) : (
        <>
          <div className={styles.emptystate}>
            <Users className={styles.noPointer} aria-hidden />
            <FormSelect
              name="contact_group"
              className={styles.picker}
              value={selectedGroupId}
              onValueChange={setSelectedGroupId}
              options={groupOptions}
              placeholder="Pilih grup…"
            />
          </div>

          {selectedGroup ? (
            <div className={styles.region}>
              <div className={styles.block}>
                <p className={styles.textPrimary}>Pratinjau: {selectedGroup.groupName}</p>
                <Badge tone="blue">{selectedGroup.contacts.length} kontak</Badge>
              </div>
              {selectedGroup.contacts.length === 0 ? (
                <p className={styles.textSecondary}>Grup ini masih kosong.</p>
              ) : (
                <ul className={styles.list}>
                  {selectedGroup.contacts.map((contact) => (
                    <li
                      key={contact.id}
                      className={styles.item}
                    >
                      <span className={styles.meta}>{contact.fullName}</span>
                      <span className={styles.caption}>{contact.email}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="default"
                size="lg"
                className={styles.button}
                disabled={selectedGroup.contacts.length === 0}
                onClick={handleApply}
              >
                Tambahkan ke penerima
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
