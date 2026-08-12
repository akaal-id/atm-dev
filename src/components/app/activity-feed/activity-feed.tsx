"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ActivityLog, User } from "@/lib/types";
import { formatDate } from "@/lib/utils";

import styles from "./activity-feed.module.css";

function userName(users: User[], id: string) {
  return users.find((user) => user.user_id === id)?.full_name ?? "Unknown user";
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className={styles.title}>{title}</h2>;
}

function EmptyState({ label }: { label: string }) {
  return <p className={styles.empty}>{label}</p>;
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
      <CardBody className={styles.body}>
        {logs.length === 0 ? <EmptyState label={emptyLabel} /> : null}
        {visibleLogs.map((log) => (
          <div key={log.log_id} className={styles.item}>
            <div className={styles.marker} />
            <div className={styles.itemBody}>
              <p className={styles.itemDescription}>{log.description}</p>
              <p className={styles.itemMeta}>
                {userName(users, log.user_id)} - {formatDate(log.created_at, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {canCollapse && !expanded ? (
          <Button type="button" variant="outline" size="lg" className={styles.showMore} onClick={() => setExpanded(true)}>
            Show more
          </Button>
        ) : null}
        {canCollapse && expanded ? (
          <Button type="button" variant="outline" size="lg" className={styles.showMore} onClick={() => setExpanded(false)}>
            Show less
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
