"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ActivityLog, User } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function userName(users: User[], id: string) {
  return users.find((user) => user.user_id === id)?.full_name ?? "Unknown user";
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-slate-950">{title}</h2>;
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}

export function ActivityFeed({
  logs,
  users,
  title = "Recent activity",
  emptyLabel = "No activity yet.",
  initialLimit,
}: {
  logs: ActivityLog[];
  users: User[];
  title?: string;
  emptyLabel?: string;
  initialLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = initialLimit && initialLimit > 0 ? initialLimit : logs.length;
  const canCollapse = Boolean(initialLimit && logs.length > limit);
  const visibleLogs = expanded || !canCollapse ? logs : logs.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <SectionTitle title={title} />
      </CardHeader>
      <CardBody className="space-y-3">
        {logs.length === 0 ? <EmptyState label={emptyLabel} /> : null}
        {visibleLogs.map((log) => (
          <div key={log.log_id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-slate-950">{log.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {userName(users, log.user_id)} - {formatDate(log.created_at, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {canCollapse && !expanded ? (
          <Button type="button" variant="outline" size="lg" className="h-10 w-full font-semibold" onClick={() => setExpanded(true)}>
            Show more
          </Button>
        ) : null}
        {canCollapse && expanded ? (
          <Button type="button" variant="outline" size="lg" className="h-10 w-full font-semibold" onClick={() => setExpanded(false)}>
            Show less
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
