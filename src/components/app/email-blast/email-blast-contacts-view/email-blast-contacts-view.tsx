"use client";

import styles from "./email-blast-contacts-view.module.css";

import Link from "next/link";
import { ChevronRight, Mail, Plus, Search, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmailBlastCreateGroupForm } from "@/components/app/email-blast/email-blast-create-group-form";
import { Page } from "@/components/app/page-layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import type { MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 10;
const ALL_CREATORS = "all";

type SortMode = "newest" | "oldest" | "name";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "name", label: "Nama A-Z" },
];

function mapGroups(rows: unknown[]): MockContactGroup[] {
  return rows.map((entry) => {
    const group = entry as {
      id: string;
      group_name: string;
      created_at: string;
      created_by?: { user_id?: string; full_name?: string };
      contacts?: Array<{ id: string; email: string; full_name: string; company?: string; verification_status?: string }>;
    };
    return {
      id: group.id,
      groupName: group.group_name,
      createdAt: group.created_at,
      createdBy: group.created_by?.user_id
        ? {
            userId: group.created_by.user_id,
            fullName: group.created_by.full_name || group.created_by.user_id,
          }
        : undefined,
      contacts: (group.contacts || []).map((contact) => ({
        id: contact.id,
        email: contact.email,
        fullName: contact.full_name,
        company: contact.company || "",
        verificationStatus:
          (contact.verification_status as MockContactGroup["contacts"][number]["verificationStatus"]) || "unchecked",
      })),
    };
  });
}

function sortGroups(groups: MockContactGroup[], sort: SortMode) {
  const sorted = [...groups];
  if (sort === "name") return sorted.sort((left, right) => left.groupName.localeCompare(right.groupName, undefined, { sensitivity: "base" }));
  sorted.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return sort === "oldest" ? sorted : sorted.reverse();
}

/** Contact groups index — company-shared table of groups. */
export function EmailBlastContactsView() {
  const [groups, setGroups] = useState<MockContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [createdByFilter, setCreatedByFilter] = useState(ALL_CREATORS);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/email-blast/contact-groups", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      setGroups(mapGroups(Array.isArray(body?.data) ? body.data : []));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(groupName: string) {
    setCreating(true);
    try {
      const response = await fetch("/api/email-blast/contact-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group_name: groupName }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Gagal membuat grup.");
      await refresh();
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    const confirmed = window.confirm(`Hapus grup "${groupName}" beserta seluruh anggotanya?`);
    if (!confirmed) return;
    const response = await fetch("/api/email-blast/contact-groups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: groupId }),
    });
    if (!response.ok) return;
    await refresh();
  }

  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      if (!group.createdBy?.userId) continue;
      map.set(group.createdBy.userId, group.createdBy.fullName);
    }
    return [
      { value: ALL_CREATORS, label: "Created by: All" },
      ...[...map.entries()]
        .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
        .map(([userId, fullName]) => ({ value: userId, label: `Created by: ${fullName}` })),
    ];
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      if (createdByFilter !== ALL_CREATORS && group.createdBy?.userId !== createdByFilter) return false;
      if (!trimmed) return true;
      const haystack = [
        group.groupName,
        group.createdBy?.fullName || "",
        ...group.contacts.map((c) => `${c.fullName} ${c.email} ${c.company}`),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
    return sortGroups(filtered, sort);
  }, [groups, query, sort, createdByFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, createdByFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Page>
      <div className="ws-toolbar">
        <div className={styles.actions}>
          <Search className={styles.noPointer} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={styles.input}
            placeholder="Cari nama grup, kontak, atau company"
          />
        </div>
        <FilterSelect
          value={createdByFilter}
          options={creatorOptions}
          onValueChange={setCreatedByFilter}
          fullWidth={false}
        />
        <FilterSelect
          value={sort}
          options={SORT_OPTIONS}
          onValueChange={(value) => setSort(value as SortMode)}
          fullWidth={false}
        />
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "outline", size: "xl" }))}>
          <Mail className={styles.icon} />
          Compose
        </Link>
        <Button type="button" variant="default" size="xl" onClick={() => setCreateOpen(true)}>
          <Plus className={styles.icon} />
          New group
        </Button>
      </div>

      <Card>
        <CardBody className={styles.body}>
          {groups.length === 0 && !loading ? (
            <div className={styles.emptyText}>
              <Users className={styles.bodyUsers} />
              <p className={styles.emptyText}>Belum ada grup kontak.</p>
              <p className={styles.bodyUsers}>Buat grup pertama untuk mempercepat blast berulang.</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className={styles.emptystate}>Tidak ada grup yang cocok dengan filter.</div>
          ) : (
            <div className={styles.emptystateDiv}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {["Group", "Contacts", "Verified", "Created by", "Created", ""].map((header) => (
                      <th key={header} className={styles.headercell}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((group) => {
                    const verifiedCount = group.contacts.filter((c) => c.verificationStatus === "valid").length;
                    return (
                      <tr key={group.id} className={styles.filterBar}>
                        <td className={styles.cell}>
                          <Link href={`/email-blast/contacts/${group.id}`} className={styles.link}>
                            {group.groupName}
                          </Link>
                        </td>
                        <td className={styles.tableCell}>{group.contacts.length}</td>
                        <td className={styles.tableCell}>
                          {verifiedCount}/{group.contacts.length}
                        </td>
                        <td className={styles.tableCell}>
                          {group.createdBy?.fullName ? `Created by ${group.createdBy.fullName}` : "—"}
                        </td>
                        <td className={styles.tableCell}>{formatDate(group.createdAt)}</td>
                        <td className={styles.cell}>
                          <div className={styles.group}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={styles.button}
                              aria-label={`Hapus grup ${group.groupName}`}
                              onClick={() => void handleDeleteGroup(group.id, group.groupName)}
                            >
                              <Trash2 className={styles.icon} />
                            </Button>
                            <Link
                              href={`/email-blast/contacts/${group.id}`}
                              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), styles.item)}
                              aria-label={`Buka grup ${group.groupName}`}
                            >
                              <ChevronRight className={styles.icon} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
        <Pagination page={currentPage} pageCount={pageCount} totalItems={filteredGroups.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Buat grup baru" eyebrow="Contact groups">
        <EmailBlastCreateGroupForm busy={creating} onCreate={handleCreate} />
      </Modal>
    </Page>
  );
}
