"use client";

import styles from "./task-scoring-panel.module.css";

import { Loader2, Pencil, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useWorkTypes } from "@/components/app/create-task-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_SCORING_CONFIG, DONE_STATUSES, taskEffort, taskShares, trackLabel } from "@/lib/scoring";
import { requestJson } from "@/lib/request-json";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Person = { user_id: string; full_name: string; photo: string };

/**
 * Assignees with their share of the task's effort points, plus work type, revisions and rating.
 * The task's leader can change the scoring inline.
 */
export function TaskScoringPanel({ task, people, assignedByName, canEdit }: { task: Task; people: Person[]; assignedByName: string; canEdit: boolean }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const catalog = useWorkTypes();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    work_type_id: task.work_type_id ?? "",
    effort_points: task.effort_points ? String(task.effort_points) : "",
    pic_user_id: task.pic_user_id ?? "",
    custom: Object.keys(task.contribution_shares ?? {}).length > 0,
    shares: Object.fromEntries(task.assigned_to.map((id) => [id, String(task.contribution_shares?.[id] ?? "")])) as Record<string, string>,
    quality_rating: task.quality_rating ?? 0,
  }));

  const config = { ...DEFAULT_SCORING_CONFIG, workTypes: catalog?.workTypes ?? DEFAULT_SCORING_CONFIG.workTypes, defaultEffort: catalog?.defaultEffort ?? 2, picShare: catalog?.picShare ?? 0.6 };
  const effort = taskEffort(task, config);
  const shares = taskShares(task, config);
  const workType = config.workTypes.find((type) => type.id === task.work_type_id);
  const name = new Map(people.map((person) => [person.user_id, person]));
  const done = DONE_STATUSES.has(task.status);

  async function save() {
    setSaving(true);
    try {
      const shareEntries = form.custom ? Object.entries(form.shares).filter(([, value]) => Number(value) > 0) : [];
      await requestJson(`/api/tasks/${task.task_id}/scoring`, "PATCH", {
        work_type_id: form.work_type_id,
        effort_points: form.effort_points === "" ? null : Number(form.effort_points),
        pic_user_id: form.pic_user_id,
        contribution_shares: Object.fromEntries(shareEntries.map(([id, value]) => [id, Number(value)])),
        quality_rating: form.quality_rating || null,
      });
      pushToast({ tone: "success", title: "Scoring updated" });
      setEditing(false);
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not update scoring", description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <span>
          {workType ? `${trackLabel(workType.track)} · ${workType.name}` : "No work type"} · <strong>{effort} pts</strong>
          {task.effort_points ? <span className={styles.muted}> (set by leader)</span> : null}
        </span>
        {canEdit && !editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className={styles.icon} aria-hidden />
            Edit scoring
          </Button>
        ) : null}
      </div>

      <ul className={styles.people}>
        {task.assigned_to.map((id) => {
          const person = name.get(id);
          const share = shares.get(id) ?? 0;
          return (
            <li key={id}>
              <Avatar name={person?.full_name ?? id} image={person?.photo || undefined} size="sm" />
              <span className={styles.personText}>
                <span>
                  {person?.full_name ?? id} {task.pic_user_id === id && task.assigned_to.length > 1 ? <Badge tone="purple">PIC</Badge> : null}
                </span>
                <span className={styles.muted}>Assigned by {assignedByName}</span>
              </span>
              <span className={styles.share}>
                <strong>{Math.round(share * 100)}%</strong>
                <span className={styles.muted}>{Math.round(effort * share * 10) / 10} pts</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className={styles.muted}>
        {Number(task.revision_count) > 0 ? `${task.revision_count} revision round${Number(task.revision_count) > 1 ? "s" : ""}` : "No revisions"} ·{" "}
        {task.quality_rating ? `Rated ${task.quality_rating}/5` : done ? "Not rated" : "Rating after approval"}
      </p>

      {editing ? (
        <div className={styles.editor}>
          <label className={styles.field}>
            <span>Work type</span>
            <FormSelect
              name="scoring_work_type"
              value={form.work_type_id}
              onValueChange={(value) => setForm({ ...form, work_type_id: value })}
              placeholder="Not set"
              options={[{ value: "", label: "Not set" }, ...config.workTypes.map((type) => ({ value: type.id, label: `${trackLabel(type.track)} · ${type.name} (${type.effort})` }))]}
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Effort override</span>
              <input className="input" type="number" min={0.5} max={40} step={0.5} placeholder="From work type" value={form.effort_points} onChange={(event) => setForm({ ...form, effort_points: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>PIC</span>
              <FormSelect
                name="scoring_pic"
                value={form.pic_user_id}
                onValueChange={(value) => setForm({ ...form, pic_user_id: value })}
                placeholder="None — split equally"
                options={[{ value: "", label: "None — split equally" }, ...task.assigned_to.map((id) => ({ value: id, label: name.get(id)?.full_name ?? id }))]}
              />
            </label>
          </div>
          {task.assigned_to.length > 1 ? (
            <div className={styles.field}>
              <label className={styles.check}>
                <input type="checkbox" checked={form.custom} onChange={(event) => setForm({ ...form, custom: event.target.checked })} />
                <span>Custom split (relative weights, e.g. 3 / 1 / 1)</span>
              </label>
              {form.custom ? (
                <div className={styles.shares}>
                  {task.assigned_to.map((id) => (
                    <label key={id} className={styles.shareInput}>
                      <span>{name.get(id)?.full_name ?? id}</span>
                      <input className="input" type="number" min={0} max={100} step={1} value={form.shares[id] ?? ""} onChange={(event) => setForm({ ...form, shares: { ...form.shares, [id]: event.target.value } })} />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {done ? (
            <div className={styles.field}>
              <span>Quality rating</span>
              <div className={styles.stars} role="radiogroup" aria-label="Quality rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.quality_rating === value}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    className={cn(styles.star, value <= form.quality_rating && styles.starOn)}
                    onClick={() => setForm({ ...form, quality_rating: form.quality_rating === value ? 0 : value })}
                  >
                    <Star />
                  </button>
                ))}
                <span className={styles.muted}>{form.quality_rating ? `${form.quality_rating}/5 — overrides the revision count` : "Not rated"}</span>
              </div>
            </div>
          ) : null}
          <div className={styles.actions}>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className={styles.spin} aria-hidden /> : null}
              Save scoring
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
