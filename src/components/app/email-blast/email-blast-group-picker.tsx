"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MockContactGroup } from "@/lib/data/email-blast-contacts-mock";

interface EmailBlastGroupPickerProps {
  groups: MockContactGroup[];
  onApplyGroup: (emails: string[]) => void;
}

/** Pick a saved contact group, preview members, then add to recipients. */
export function EmailBlastGroupPicker({ groups, onApplyGroup }: EmailBlastGroupPickerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  function handleApply() {
    if (!selectedGroup || selectedGroup.contacts.length === 0) return;
    onApplyGroup(selectedGroup.contacts.map((contact) => contact.email.toLowerCase()));
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Pilih grup kontak</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Pratinjau anggota grup, lalu tambahkan ke daftar penerima.
          </p>
        </div>
        <Link href="/email-blast/contacts" className="text-sm font-semibold text-blue-600 hover:underline">
          Kelola grup
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm font-medium text-slate-500">
          Belum ada grup. Buat grup di halaman kontak terlebih dahulu.
        </p>
      ) : (
        <>
          <div className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <select
              className="input appearance-none pl-9"
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              aria-label="Pilih grup kontak"
            >
              <option value="">Pilih grup…</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.groupName} ({group.contacts.length})
                </option>
              ))}
            </select>
          </div>

          {selectedGroup ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Pratinjau: {selectedGroup.groupName}</p>
                <Badge tone="blue">{selectedGroup.contacts.length} kontak</Badge>
              </div>
              {selectedGroup.contacts.length === 0 ? (
                <p className="text-sm font-medium text-slate-500">Grup ini masih kosong.</p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                  {selectedGroup.contacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <span className="truncate text-sm font-medium text-slate-800">{contact.fullName}</span>
                      <span className="shrink-0 truncate text-xs font-medium text-slate-500">{contact.email}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="default"
                size="lg"
                className="h-10 w-full sm:w-auto"
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
