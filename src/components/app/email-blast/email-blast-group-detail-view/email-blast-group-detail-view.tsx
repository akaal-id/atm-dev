"use client";

import styles from "./email-blast-group-detail-view.module.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EmailBlastAddContactForm,
  type NewContactInput,
} from "@/components/app/email-blast/email-blast-add-contact-form";
import { EmailBlastGroupMembersTable } from "@/components/app/email-blast/email-blast-group-members-table";
import { EmailBlastImportExcelForm } from "@/components/app/email-blast/email-blast-import-excel-form";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ContactVerificationStatus, MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 10;
const ALL_STATUS = "all";
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL_STATUS, label: "Semua status" },
  { value: "unchecked", label: "Belum dicek" },
  { value: "valid", label: "Verified" },
  { value: "invalid", label: "Email tidak valid" },
  { value: "unknown", label: "Gagal dicek" },
];

function mapGroup(row: unknown): MockContactGroup | null {
  if (!row || typeof row !== "object") return null;
  const group = row as {
    id: string;
    group_name: string;
    created_at: string;
    created_by?: { user_id?: string; full_name?: string };
    contacts?: Array<{
      id: string;
      email: string;
      full_name: string;
      company?: string;
      verification_status?: ContactVerificationStatus;
      verification_detail?: string;
    }>;
  };
  if (!group.id) return null;
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
      verificationStatus: contact.verification_status || "unchecked",
      verificationDetail: contact.verification_detail || "",
    })),
  };
}

/** Dedicated page to manage one contact group's members. */
export function EmailBlastGroupDetailView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<MockContactGroup | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS);
  const [page, setPage] = useState(1);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/email-blast/contact-groups/${groupId}`, { cache: "no-store" });
      if (response.status === 404) {
        setGroup(null);
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error || "Gagal memuat grup.");
        setGroup(null);
        return;
      }
      setGroup(mapGroup(body?.data ?? null));
      setError("");
    } catch {
      setError("Gagal memuat grup.");
      setGroup(null);
    }
  }, [groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAddContacts(contacts: NewContactInput[]) {
    setBusy(true);
    try {
      const response = await fetch("/api/email-blast/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          contacts: contacts.map((contact) => ({
            email: contact.email,
            full_name: contact.fullName,
            company: contact.company,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Gagal menambahkan kontak.");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveContact(contactId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/email-blast/contacts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: contactId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Gagal menghapus kontak.");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(contactIds?: string[]) {
    setVerifying(true);
    setInfo("");
    setError("");
    try {
      const response = await fetch("/api/email-blast/contacts/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          contactIds?.length
            ? { contact_ids: contactIds }
            : { group_id: groupId },
        ),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Gagal memverifikasi email.");
      }
      const summary = payload?.summary as
        | { total: number; valid: number; invalid: number; unknown: number }
        | undefined;
      if (summary) {
        setInfo(
          `Selesai cek ${summary.total} email: ${summary.valid} verified, ${summary.invalid} tidak valid, ${summary.unknown} gagal dicek.`,
        );
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memverifikasi email.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;
    const confirmed = window.confirm(`Hapus grup "${group.groupName}" beserta seluruh anggotanya?`);
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch("/api/email-blast/contact-groups", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: groupId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Gagal menghapus grup.");
      }
      router.push("/email-blast/contacts");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus grup.");
      setBusy(false);
    }
  }

  const filteredContacts = useMemo(() => {
    if (!group) return [];
    const trimmed = query.trim().toLowerCase();
    return group.contacts.filter((contact) => {
      if (statusFilter !== ALL_STATUS && (contact.verificationStatus || "unchecked") !== statusFilter) return false;
      if (!trimmed) return true;
      const haystack = `${contact.fullName} ${contact.email} ${contact.company}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [group, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedContacts = filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (group === undefined) {
    return (
      <Page>
        <div className={styles.filterBar}>
          Memuat detail grup…
        </div>
      </Page>
    );
  }

  if (!group) {
    return (
      <Page>
        <div className={styles.emptystate}>
          <p className={styles.emptyText}>Grup tidak ditemukan</p>
          <p className={styles.emptytextP}>{error || "Grup mungkin sudah dihapus atau ID tidak valid."}</p>
          <Link href="/email-blast/contacts" className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.item)}>
            <ArrowLeft className={styles.icon} />
            Kembali ke contacts
          </Link>
        </div>
      </Page>
    );
  }

  const locked = busy || verifying;

  return (
    <Page>
      <div className="ws-toolbar">
        <Link href="/email-blast/contacts" className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), styles.link)} aria-label="Back to contacts">
          <ArrowLeft className={styles.icon} />
        </Link>
        <div className={styles.content}>
          <h1 className={styles.title}>{group.groupName}</h1>
          <p className={styles.itemMeta}>
            Dibuat {formatDate(group.createdAt)}
            {group.createdBy?.fullName ? ` · Created by ${group.createdBy.fullName}` : ""}
          </p>
        </div>
        <Badge tone="blue" className={styles.glyph}>
          <Users className={styles.iconUsers} />
          {group.contacts.length} contacts
        </Badge>
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "outline", size: "xl" }))}>
          <Mail className={styles.icon} />
          Compose
        </Link>
      </div>

      {error ? (
        <div className={styles.panel}>
          {error}
        </div>
      ) : null}
      {info ? (
        <div className={styles.iconDiv}>
          {info}
        </div>
      ) : null}

      <div className="ws-toolbar">
        <div className={styles.actions}>
          <Search className={styles.noPointer} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn("input", styles.searchField)}
            placeholder="Cari nama, email, atau company"
          />
        </div>
        <FilterSelect value={statusFilter} options={STATUS_OPTIONS} onValueChange={setStatusFilter} fullWidth={false} />

        <Button
          type="button"
          variant="outline"
          size="xl"
          disabled={locked || group.contacts.length === 0}
          onClick={() => void handleVerify()}
        >
          <ShieldCheck className={styles.icon} />
          {verifying ? "Mengecek…" : "Cek semua email"}
        </Button>

        <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen} modal={false}>
          <PopoverTrigger
            type="button"
            disabled={locked}
            className={cn(buttonVariants({ variant: "default", size: "xl" }))}
          >
            <UserPlus className={styles.icon} />
            Tambah ke grup
            <ChevronDown className={styles.icon} />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className={styles.popovercontent}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setAddMenuOpen(false);
                setAddOpen(true);
              }}
            >
              <UserPlus className={styles.iconUserplus} />
              Input manual
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setAddMenuOpen(false);
                setImportOpen(true);
              }}
            >
              <FileSpreadsheet className={styles.iconUserplus} />
              Upload file
            </button>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="destructiveOutline"
          size="xl"
          disabled={locked}
          onClick={() => void handleDeleteGroup()}
        >
          <Trash2 className={styles.icon} />
          Hapus grup
        </Button>
      </div>

      <Card>
        <CardBody className={styles.body}>
          {group.contacts.length === 0 ? (
            <div className={styles.bodyDiv}>
              <Users className={styles.bodyUsers} />
              <p className={styles.bodyDiv}>Belum ada kontak</p>
              <p className={styles.itemMeta}>Klik &quot;Tambah ke grup&quot; untuk menambah anggota.</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className={styles.bodyUsers}>Tidak ada kontak yang cocok dengan filter.</div>
          ) : (
            <EmailBlastGroupMembersTable
              contacts={pagedContacts}
              busy={locked}
              onVerify={(contactId) => void handleVerify([contactId])}
              onRemove={(contactId) => void handleRemoveContact(contactId)}
            />
          )}
        </CardBody>
        <Pagination page={currentPage} pageCount={pageCount} totalItems={filteredContacts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah kontak manual" eyebrow={group.groupName}>
        <EmailBlastAddContactForm
          groupName={group.groupName}
          busy={busy}
          onAdd={async (contacts) => {
            await handleAddContacts(contacts);
            setAddOpen(false);
          }}
        />
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Tambah dari Excel" eyebrow={group.groupName}>
        <EmailBlastImportExcelForm
          groupName={group.groupName}
          busy={busy}
          onAdd={async (contacts) => {
            await handleAddContacts(contacts);
            setImportOpen(false);
          }}
        />
      </Modal>
    </Page>
  );
}
