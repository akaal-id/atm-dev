"use client";

import styles from "./project-kpi-panel.module.css";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatKpiValue, kpiAchievement } from "@/lib/project-kpi";
import { requestJson } from "@/lib/request-json";
import type { ProjectKpi, StrategyOption } from "@/lib/types/project-hub";
import { cn } from "@/lib/utils";

type KpiDraft = { name: string; unit: string; target_value: string; actual_value: string; channel: string; funnel: string };

const emptyDraft: KpiDraft = { name: "", unit: "", target_value: "", actual_value: "", channel: "", funnel: "" };

function toDraft(kpi: ProjectKpi): KpiDraft {
  return {
    name: kpi.name,
    unit: kpi.unit,
    target_value: String(kpi.target_value),
    actual_value: String(kpi.actual_value),
    channel: kpi.channel,
    funnel: kpi.funnel,
  };
}

function achievementTone(value: number) {
  if (value >= 100) return styles.barDone;
  if (value >= 60) return styles.barMid;
  return styles.barLow;
}

export function ProjectKpiPanel({
  projectId,
  kpis,
  strategy,
  canEdit,
}: {
  projectId: string;
  kpis: ProjectKpi[];
  strategy: StrategyOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [editing, setEditing] = useState<ProjectKpi | "new" | null>(null);
  const [draft, setDraft] = useState<KpiDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const optionsFor = (type: StrategyOption["type"]) => [
    { value: "", label: "Any" },
    ...strategy.filter((option) => option.type === type).map((option) => ({ value: option.label, label: option.label })),
  ];

  function open(target: ProjectKpi | "new") {
    setDraft(target === "new" ? emptyDraft : toDraft(target));
    setEditing(target);
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      pushToast({ tone: "success", title: success });
      setEditing(null);
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save KPI", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    const body = { ...draft, sort_order: editing === "new" ? kpis.length : undefined };
    void run(
      () =>
        editing === "new" || editing === null
          ? requestJson(`/api/projects/${projectId}/kpis`, "POST", body)
          : requestJson(`/api/projects/${projectId}/kpis/${editing.kpi_id}`, "PATCH", body),
      editing === "new" ? "KPI added" : "KPI updated",
    );
  }

  function onDelete() {
    if (!editing || editing === "new" || busy) return;
    void run(() => requestJson(`/api/projects/${projectId}/kpis/${editing.kpi_id}`, "DELETE"), "KPI deleted");
  }

  return (
    <Card>
      <CardHeader className={styles.header}>
        <div>
          <h2 className={styles.title}>Target KPI</h2>
          <p className={styles.subtitle}>Target vs actual for this period</p>
        </div>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => open("new")}>
            <Plus className={styles.icon} aria-hidden />
            Add KPI
          </Button>
        ) : null}
      </CardHeader>
      <CardBody>
        {kpis.length === 0 ? (
          <p className={styles.empty}>No KPIs yet{canEdit ? " — add targets like reach, engagement rate, leads, or sales." : "."}</p>
        ) : (
          <ul className={styles.list}>
            {kpis.map((kpi) => {
              const achievement = kpiAchievement(kpi);
              return (
                <li key={kpi.kpi_id} className={styles.item}>
                  <div className={styles.itemHead}>
                    <div className={styles.itemName}>
                      <p className={styles.name}>{kpi.name}</p>
                      <div className={styles.tags}>
                        {kpi.channel ? <Badge tone="blue">{kpi.channel}</Badge> : null}
                        {kpi.funnel ? <Badge tone="purple">{kpi.funnel}</Badge> : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => open(kpi)} aria-label={`Edit ${kpi.name}`}>
                        <Pencil className={styles.icon} />
                      </Button>
                    ) : null}
                  </div>
                  <div className={styles.numbers}>
                    <span className={styles.actual}>{formatKpiValue(kpi.actual_value, kpi.unit)}</span>
                    <span className={styles.target}>/ {formatKpiValue(kpi.target_value, kpi.unit)}</span>
                    <span className={styles.percent}>{achievement}%</span>
                  </div>
                  <div className={styles.track} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, achievement)} aria-label={`${kpi.name} achievement`}>
                    <div className={cn(styles.bar, achievementTone(achievement))} style={{ width: `${Math.min(100, achievement)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={editing === "new" ? "Add KPI" : "Edit KPI"} eyebrow="Target KPI">
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>KPI name</span>
            <input className="input" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Reach, Engagement rate, Leads" />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Target</span>
              <input className="input" type="number" min="0" step="any" value={draft.target_value} onChange={(event) => setDraft({ ...draft, target_value: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Actual</span>
              <input className="input" type="number" min="0" step="any" value={draft.actual_value} onChange={(event) => setDraft({ ...draft, actual_value: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Unit</span>
              <input className="input" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="%, views, leads" />
            </label>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Channel</span>
              <FormSelect name="channel" value={draft.channel} onValueChange={(channel) => setDraft({ ...draft, channel })} options={optionsFor("channel")} placeholder="Any" />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Funnel</span>
              <FormSelect name="funnel" value={draft.funnel} onValueChange={(funnel) => setDraft({ ...draft, funnel })} options={optionsFor("funnel")} placeholder="Any" />
            </div>
          </div>
          <div className={styles.actions}>
            {editing && editing !== "new" ? (
              <Button type="button" variant="destructiveOutline" onClick={onDelete} disabled={busy}>
                <Trash2 className={styles.icon} aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy || !draft.name.trim()}>
              {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
