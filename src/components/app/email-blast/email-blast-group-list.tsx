"use client";

import Link from "next/link";
import { ChevronRight, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { formatDate } from "@/lib/utils";

interface EmailBlastGroupListProps {
  groups: MockContactGroup[];
  onDeleteGroup?: (groupId: string) => void;
}

/** Contact group cards — click opens the dedicated group detail page. */
export function EmailBlastGroupList({ groups, onDeleteGroup }: EmailBlastGroupListProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada grup kontak.</p>
        <p className="mt-1 text-sm text-slate-500">Buat grup pertama untuk mempercepat blast berulang.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <article
          key={group.id}
          className="rounded-lg border border-slate-200 bg-white transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="flex items-start gap-1 p-4">
            <Link href={`/email-blast/contacts/${group.id}`} className="min-w-0 flex-1 outline-none">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-950">{group.groupName}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">Dibuat {formatDate(group.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone="blue">{group.contacts.length}</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {group.contacts.length === 0 ? (
                  <li className="text-sm text-slate-400">Belum ada kontak — buka untuk menambah.</li>
                ) : (
                  group.contacts.slice(0, 3).map((contact) => (
                    <li key={contact.id} className="truncate text-sm text-slate-600">
                      {contact.fullName ? `${contact.fullName} · ` : ""}
                      {contact.email}
                    </li>
                  ))
                )}
                {group.contacts.length > 3 ? (
                  <li className="text-xs font-medium text-slate-400">+{group.contacts.length - 3} lainnya</li>
                ) : null}
              </ul>
            </Link>

            {onDeleteGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0 text-slate-400 hover:text-red-600"
                aria-label={`Hapus grup ${group.groupName}`}
                onClick={(event) => {
                  event.preventDefault();
                  onDeleteGroup(group.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
