"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  EmailBlastAddContactForm,
  type NewContactInput,
} from "@/components/app/email-blast/email-blast-add-contact-form";
import { EmailBlastGroupMembersTable } from "@/components/app/email-blast/email-blast-group-members-table";
import { EmailBlastImportExcelForm } from "@/components/app/email-blast/email-blast-import-excel-form";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ContactVerificationStatus, MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { cn, formatDate } from "@/lib/utils";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function mapGroup(row: unknown): MockContactGroup | null {
  if (!row || typeof row !== "object") return null;
  const group = row as {
    id: string;
    group_name: string;
    created_at: string;
    contacts?: Array<{
      id: string;
      email: string;
      full_name: string;
      verification_status?: ContactVerificationStatus;
      verification_detail?: string;
    }>;
  };
  if (!group.id) return null;
  return {
    id: group.id,
    groupName: group.group_name,
    createdAt: group.created_at,
    contacts: (group.contacts || []).map((contact) => ({
      id: contact.id,
      email: contact.email,
      fullName: contact.full_name,
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

  if (group === undefined) {
    return (
      <Page>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Memuat detail grup…
        </div>
      </Page>
    );
  }

  if (!group) {
    return (
      <Page>
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Grup tidak ditemukan</p>
          <p className="text-sm text-slate-600">{error || "Grup mungkin sudah dihapus atau ID tidak valid."}</p>
          <Link href="/email-blast/contacts" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke contacts
          </Link>
        </div>
      </Page>
    );
  }

  const locked = busy || verifying;

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/email-blast/contacts" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Link>
        <Badge tone="blue">
          <Users className="mr-1 inline h-3.5 w-3.5" />
          {group.contacts.length} contacts
        </Badge>
        <Link href="/email-blast" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
          <Mail className="h-4 w-4" />
          Compose
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
          {info}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <SectionTitle title={group.groupName} />
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-slate-600">Dibuat {formatDate(group.createdAt)}</p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 w-full"
                disabled={locked || group.contacts.length === 0}
                onClick={() => void handleVerify()}
              >
                <ShieldCheck className="h-4 w-4" />
                {verifying ? "Mengecek…" : "Cek semua email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={locked}
                onClick={() => void handleDeleteGroup()}
              >
                <Trash2 className="h-4 w-4" />
                Hapus grup
              </Button>
            </CardBody>
          </Card>

          <EmailBlastAddContactForm groupName={group.groupName} busy={locked} onAdd={handleAddContacts} />
          <EmailBlastImportExcelForm groupName={group.groupName} busy={locked} onAdd={handleAddContacts} />
        </div>

        <Card>
          <CardHeader>
            <SectionTitle title="Anggota grup" action={<Badge tone="neutral">{group.contacts.length}</Badge>} />
          </CardHeader>
          <CardBody className="space-y-3">
            {group.contacts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada kontak</p>
                <p className="mt-1 text-sm text-slate-500">Tambahkan email di form sebelah kiri.</p>
              </div>
            ) : (
              <EmailBlastGroupMembersTable
                contacts={group.contacts}
                busy={locked}
                onVerify={(contactId) => void handleVerify([contactId])}
                onRemove={(contactId) => void handleRemoveContact(contactId)}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
