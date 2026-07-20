"use client";

import Link from "next/link";
import { Mail, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmailBlastCreateGroupForm } from "@/components/app/email-blast/email-blast-create-group-form";
import { EmailBlastGroupList } from "@/components/app/email-blast/email-blast-group-list";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { cn } from "@/lib/utils";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function mapGroups(rows: unknown[]): MockContactGroup[] {
  return rows.map((entry) => {
    const group = entry as {
      id: string;
      group_name: string;
      created_at: string;
      contacts?: Array<{ id: string; email: string; full_name: string }>;
    };
    return {
      id: group.id,
      groupName: group.group_name,
      createdAt: group.created_at,
      contacts: (group.contacts || []).map((contact) => ({
        id: contact.id,
        email: contact.email,
        fullName: contact.full_name,
      })),
    };
  });
}

/** Contact groups index — create groups and open detail pages to manage members. */
export function EmailBlastContactsView() {
  const [groups, setGroups] = useState<MockContactGroup[]>([]);
  const [loading, setLoading] = useState(true);

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
    const response = await fetch("/api/email-blast/contact-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_name: groupName }),
    });
    if (!response.ok) return;
    await refresh();
  }

  async function handleDeleteGroup(groupId: string) {
    const response = await fetch("/api/email-blast/contact-groups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: groupId }),
    });
    if (!response.ok) return;
    await refresh();
  }

  return (
    <Page>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <EmailBlastCreateGroupForm onCreate={(name) => void handleCreate(name)} />

        <Card>
          <CardHeader>
            <SectionTitle
              title="Contact groups"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">
                    <Users className="mr-1 inline h-3.5 w-3.5" />
                    {loading ? "…" : `${groups.length} groups`}
                  </Badge>
                  <Link href="/email-blast" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
                    <Mail className="h-4 w-4" />
                    Compose
                  </Link>
                </div>
              }
            />
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Klik sebuah grup untuk membuka halaman detail dan mengelola anggotanya.
            </p>
            <EmailBlastGroupList
              groups={groups}
              onDeleteGroup={(id) => void handleDeleteGroup(id)}
            />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
