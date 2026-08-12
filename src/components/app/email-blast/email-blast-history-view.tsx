"use client";

import Link from "next/link";
import { History, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailBlastHistoryTable } from "@/components/app/email-blast/email-blast-history-table";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { Pagination } from "@/components/ui/pagination";
import type { MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

const ALL_CREATORS = "all";
const PAGE_SIZE = 10;

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface EmailBlastHistoryViewProps {
  blasts: MockEmailBlast[];
}

/** Company-shared send history with Created by filter and pagination. */
export function EmailBlastHistoryView({ blasts }: EmailBlastHistoryViewProps) {
  const [createdByFilter, setCreatedByFilter] = useState(ALL_CREATORS);
  const [page, setPage] = useState(1);

  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const blast of blasts) {
      if (!blast.createdBy?.userId) continue;
      map.set(blast.createdBy.userId, blast.createdBy.fullName);
    }
    return [
      { value: ALL_CREATORS, label: "Created by: All" },
      ...[...map.entries()]
        .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
        .map(([userId, fullName]) => ({ value: userId, label: `Created by: ${fullName}` })),
    ];
  }, [blasts]);

  useEffect(() => {
    if (createdByFilter !== ALL_CREATORS && !creatorOptions.some((option) => option.value === createdByFilter)) {
      setCreatedByFilter(ALL_CREATORS);
    }
  }, [createdByFilter, creatorOptions]);

  const filteredBlasts = useMemo(() => {
    if (createdByFilter === ALL_CREATORS) return blasts;
    return blasts.filter((blast) => blast.createdBy?.userId === createdByFilter);
  }, [blasts, createdByFilter]);

  useEffect(() => {
    setPage(1);
  }, [createdByFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBlasts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedBlasts = filteredBlasts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Page>
      <Card>
        <CardHeader>
          <SectionTitle
            title="Send history"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                  value={createdByFilter}
                  options={creatorOptions}
                  onValueChange={setCreatedByFilter}
                  fullWidth={false}
                />
                <Badge tone="neutral">
                  <History className="mr-1 inline h-3.5 w-3.5" />
                  {filteredBlasts.length} blasts
                </Badge>
                <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10")}>
                  <Plus className="h-4 w-4" />
                  Compose
                </Link>
              </div>
            }
          />
        </CardHeader>
        <CardBody className="p-0">
          <EmailBlastHistoryTable blasts={pagedBlasts} empty={filteredBlasts.length === 0} />
        </CardBody>
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          totalItems={filteredBlasts.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </Card>
    </Page>
  );
}
