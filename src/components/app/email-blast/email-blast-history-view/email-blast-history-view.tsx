"use client";

import styles from "./email-blast-history-view.module.css";

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
    <div className={styles.title}>
      <h2 className={styles.heading}>{title}</h2>
      {action ? <div className={styles.filterBar}>{action}</div> : null}
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
              <div className={styles.header}>
                <FilterSelect
                  value={createdByFilter}
                  options={creatorOptions}
                  onValueChange={setCreatedByFilter}
                  fullWidth={false}
                />
                <Badge tone="neutral">
                  <History className={styles.filterbarHistory} />
                  {filteredBlasts.length} blasts
                </Badge>
                <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), styles.item)}>
                  <Plus className={styles.icon} />
                  Compose
                </Link>
              </div>
            }
          />
        </CardHeader>
        <CardBody className={styles.body}>
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
