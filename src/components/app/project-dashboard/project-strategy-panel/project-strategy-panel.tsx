"use client";

import styles from "./project-strategy-panel.module.css";

import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { countBy } from "@/lib/content-matrix";
import { requestJson } from "@/lib/request-json";
import { strategyOptionLabels, strategyOptionTypes, type ContentItem, type StrategyOption, type StrategyOptionType } from "@/lib/types/project-hub";

export function ProjectStrategyPanel({
  projectId,
  strategy,
  content,
  canEdit,
}: {
  projectId: string;
  strategy: StrategyOption[];
  content: ContentItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<StrategyOptionType, string>>({ funnel: "", pillar: "", channel: "", theme: "" });

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) pushToast({ tone: "success", title: success });
      router.refresh();
      return true;
    } catch (error) {
      pushToast({ tone: "error", title: "Could not update strategy", description: error instanceof Error ? error.message : "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addOption(type: StrategyOptionType) {
    const label = drafts[type].trim();
    if (!label || busy) return;
    const sortOrder = strategy.filter((option) => option.type === type).length;
    const ok = await run(() => requestJson(`/api/projects/${projectId}/strategy`, "POST", { type, label, sort_order: sortOrder }));
    if (ok) setDrafts((current) => ({ ...current, [type]: "" }));
  }

  function removeOption(option: StrategyOption) {
    void run(() => requestJson(`/api/projects/${projectId}/strategy/${option.option_id}`, "DELETE"));
  }

  function saveShare(option: StrategyOption, raw: string) {
    const next = raw.trim() === "" ? null : Number(raw);
    if (next === option.target_share) return;
    void run(() => requestJson(`/api/projects/${projectId}/strategy/${option.option_id}`, "PATCH", { target_share: next }));
  }

  const counts = Object.fromEntries(strategyOptionTypes.map((type) => [type, countBy(content, type)])) as Record<StrategyOptionType, Map<string, number>>;
  const pillarContent = content.filter((item) => item.pillar).length;
  const pillars = strategy.filter((option) => option.type === "pillar");
  const pillarTotal = pillars.reduce((sum, option) => sum + (option.target_share ?? 0), 0);

  return (
    <Card>
      <CardHeader className={styles.header}>
        <div>
          <h2 className={styles.title}>Digital marketing strategy</h2>
          <p className={styles.subtitle}>Funnel, content pillars, channels, and themes used by the content matrix</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => requestJson(`/api/projects/${projectId}/strategy/defaults`, "POST"), "Akaal defaults applied")}
          >
            {busy ? <Loader2 className={styles.spinner} aria-hidden /> : <Sparkles className={styles.icon} aria-hidden />}
            Apply Akaal defaults
          </Button>
        ) : null}
      </CardHeader>
      <CardBody className={styles.groups}>
        {strategyOptionTypes.map((type) => {
          const options = strategy.filter((option) => option.type === type);
          return (
            <section key={type} className={styles.group} aria-label={strategyOptionLabels[type]}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>{strategyOptionLabels[type]}</h3>
                {type === "pillar" && pillars.length > 0 ? (
                  <span className={pillarTotal === 100 ? styles.totalOk : styles.totalWarn}>Target total {pillarTotal}%</span>
                ) : null}
              </div>

              {options.length === 0 ? <p className={styles.empty}>None yet.</p> : null}

              {type === "pillar" ? (
                <ul className={styles.pillarList}>
                  {options.map((option) => (
                    // Keyed on the saved share so the uncontrolled input resyncs after refresh.
                    <li key={`${option.option_id}:${option.target_share}`} className={styles.pillar}>
                      <div className={styles.pillarHead}>
                        <span className={styles.pillarLabel}>
                          {option.label}
                          <span className={styles.actualShare}>
                            {" "}
                            · actual {pillarContent ? Math.round(((counts.pillar.get(option.label) ?? 0) / pillarContent) * 100) : 0}% ({counts.pillar.get(option.label) ?? 0})
                          </span>
                        </span>
                        {canEdit ? (
                          <span className={styles.shareInput}>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              max="100"
                              defaultValue={option.target_share ?? ""}
                              aria-label={`${option.label} target share`}
                              onBlur={(event) => saveShare(option, event.target.value)}
                              disabled={busy}
                            />
                            %
                          </span>
                        ) : (
                          <span className={styles.shareValue}>{option.target_share ?? 0}%</span>
                        )}
                        {canEdit ? (
                          <button type="button" className={styles.remove} onClick={() => removeOption(option)} disabled={busy} aria-label={`Remove ${option.label}`}>
                            <X className={styles.removeIcon} />
                          </button>
                        ) : null}
                      </div>
                      <div className={styles.track} title="Bar = actual share · marker = target">
                        <div
                          className={styles.bar}
                          style={{ width: `${pillarContent ? ((counts.pillar.get(option.label) ?? 0) / pillarContent) * 100 : 0}%` }}
                        />
                        {option.target_share !== null ? <span className={styles.targetMarker} style={{ left: `${Math.min(100, option.target_share)}%` }} /> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={styles.chips}>
                  {options.map((option) => (
                    <li key={option.option_id} className={styles.chip} title={option.description || undefined}>
                      {option.label}
                      {type === "funnel" && option.description ? <span className={styles.chipNote}>{option.description}</span> : null}
                      <span className={styles.chipCount} title="Content in the matrix">{counts[type].get(option.label) ?? 0}</span>
                      {canEdit ? (
                        <button type="button" className={styles.remove} onClick={() => removeOption(option)} disabled={busy} aria-label={`Remove ${option.label}`}>
                          <X className={styles.removeIcon} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {canEdit ? (
                <form
                  className={styles.addRow}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addOption(type);
                  }}
                >
                  <input
                    className="input"
                    placeholder={`Add ${strategyOptionLabels[type].toLowerCase()}`}
                    value={drafts[type]}
                    onChange={(event) => setDrafts((current) => ({ ...current, [type]: event.target.value }))}
                    disabled={busy}
                  />
                  <Button type="submit" variant="outline" size="icon" disabled={busy || !drafts[type].trim()} aria-label={`Add ${strategyOptionLabels[type]}`}>
                    <Plus className={styles.icon} />
                  </Button>
                </form>
              ) : null}
            </section>
          );
        })}
      </CardBody>
    </Card>
  );
}
