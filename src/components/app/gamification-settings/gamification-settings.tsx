"use client";

import styles from "./gamification-settings.module.css";

import { Loader2, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { type ScoreTrack, type ScoringConfig, scoreTracks, trackLabel, type WorkType } from "@/lib/scoring";
import { requestJson } from "@/lib/request-json";
import { cn, formatDate } from "@/lib/utils";

type Person = { user_id: string; full_name: string; photo: string; department: string; track: ScoreTrack; trackSet: boolean };
type Adjustment = { point_id: string; user_id: string; points: number; reason: string; created_at: string };

const trackOptions = scoreTracks.map((track) => ({ value: track.id, label: track.label }));

const slug = (name: string, existing: string[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "type";
  let id = base;
  for (let n = 2; existing.includes(id); n += 1) id = `${base}-${n}`;
  return id;
};

function NumberField({ label, value, onChange, step = 1, min, max, suffix }: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <label className={styles.numberField}>
      <span>{label}</span>
      <span className={styles.numberInput}>
        <input className="input" type="number" value={Number.isFinite(value) ? value : ""} step={step} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

/** Admin editor for leaderboard v2: tracks, targets, weights, work types, multipliers, manual adjustments. */
export function GamificationSettings({ initialConfig, people, adjustments }: { initialConfig: ScoringConfig; people: Person[]; adjustments: Adjustment[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tracks, setTracks] = useState(() => Object.fromEntries(people.map((person) => [person.user_id, person.track])) as Record<string, ScoreTrack>);
  const [adjust, setAdjust] = useState({ user_id: people[0]?.user_id ?? "", points: 5, reason: "" });
  const [adjusting, setAdjusting] = useState(false);

  const update = (patch: Partial<ScoringConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const updateType = (index: number, patch: Partial<WorkType>) =>
    update({ workTypes: config.workTypes.map((type, i) => (i === index ? { ...type, ...patch } : type)) });
  const weightSum = Object.values(config.weights).reduce((sum, value) => sum + value, 0);
  const leaderSum = Object.values(config.leaderWeights).reduce((sum, value) => sum + value, 0);
  const names = new Map(people.map((person) => [person.user_id, person.full_name]));

  async function save() {
    setSaving(true);
    try {
      const saved = await requestJson<ScoringConfig>("/api/gamification/config", "PUT", config);
      setConfig(saved);
      setDirty(false);
      pushToast({ tone: "success", title: "Scoring rules saved", description: "The leaderboard uses them right away." });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save", description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function setTrack(userId: string, track: ScoreTrack) {
    const previous = tracks[userId];
    setTracks((current) => ({ ...current, [userId]: track }));
    try {
      await requestJson("/api/gamification/tracks", "PATCH", { user_id: userId, track });
      pushToast({ tone: "success", title: `${names.get(userId)} → ${trackLabel(track)}` });
    } catch (error) {
      setTracks((current) => ({ ...current, [userId]: previous }));
      pushToast({ tone: "error", title: "Could not change track", description: error instanceof Error ? error.message : undefined });
    }
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    setAdjusting(true);
    try {
      await requestJson("/api/leaderboard/score", "POST", adjust);
      pushToast({ tone: "success", title: `Adjusted ${names.get(adjust.user_id)} by ${adjust.points > 0 ? "+" : ""}${adjust.points}` });
      setAdjust((current) => ({ ...current, reason: "" }));
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Adjustment failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setAdjusting(false);
    }
  }

  const unassigned = people.filter((person) => !person.trackSet).length;

  return (
    <div className={styles.root}>
      <div className={styles.saveBar}>
        <p className={styles.muted}>{dirty ? "You have unsaved changes to the scoring rules." : "Scoring rules are up to date."}</p>
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? <Loader2 className={styles.spin} aria-hidden /> : <Save className={styles.icon} aria-hidden />}
          Save rules
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className={styles.title}>Tracks</h2>
          <p className={styles.muted}>
            Each person is scored against their track&apos;s target. Leaders are scored on their team instead.
            {unassigned ? ` ${unassigned} ${unassigned === 1 ? "person has" : "people have"} no track yet (General).` : ""}
          </p>
        </CardHeader>
        <CardBody className={styles.people}>
          {people.map((person) => (
            <div key={person.user_id} className={styles.personRow}>
              <Avatar name={person.full_name} image={person.photo || undefined} size="sm" />
              <span className={styles.personText}>
                <span>{person.full_name}</span>
                <span className={styles.muted}>{person.department || "No department"}</span>
              </span>
              <div className={styles.trackSelect}>
                <FormSelect name={`track-${person.user_id}`} value={tracks[person.user_id]} onValueChange={(value) => void setTrack(person.user_id, value as ScoreTrack)} options={trackOptions} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className={styles.grid}>
        <Card>
          <CardHeader>
            <h2 className={styles.title}>Targets</h2>
            <p className={styles.muted}>Effort points expected per 30 days. A week or quarter is pro-rated.</p>
          </CardHeader>
          <CardBody className={styles.fields}>
            {scoreTracks
              .filter((track) => track.id !== "leader")
              .map((track) => (
                <NumberField key={track.id} label={track.label} value={config.targets[track.id]} min={0} onChange={(value) => update({ targets: { ...config.targets, [track.id]: value } })} suffix="pts" />
              ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={styles.title}>Score weights</h2>
            <p className={cn(styles.muted, weightSum !== 100 && styles.warn)}>Individuals — total {weightSum}% {weightSum !== 100 ? "(should be 100)" : ""}</p>
          </CardHeader>
          <CardBody className={styles.fields}>
            <NumberField label="Output vs target" value={config.weights.output} suffix="%" onChange={(value) => update({ weights: { ...config.weights, output: value } })} />
            <NumberField label="Quality" value={config.weights.quality} suffix="%" onChange={(value) => update({ weights: { ...config.weights, quality: value } })} />
            <NumberField label="Timeliness" value={config.weights.timeliness} suffix="%" onChange={(value) => update({ weights: { ...config.weights, timeliness: value } })} />
            <NumberField label="Discipline" value={config.weights.discipline} suffix="%" onChange={(value) => update({ weights: { ...config.weights, discipline: value } })} />
            <p className={cn(styles.muted, styles.span2, leaderSum !== 100 && styles.warn)}>Leaders — total {leaderSum}%</p>
            <NumberField label="Team output" value={config.leaderWeights.teamOutput} suffix="%" onChange={(value) => update({ leaderWeights: { ...config.leaderWeights, teamOutput: value } })} />
            <NumberField label="Reviews within SLA" value={config.leaderWeights.reviewSla} suffix="%" onChange={(value) => update({ leaderWeights: { ...config.leaderWeights, reviewSla: value } })} />
            <NumberField label="Team on time" value={config.leaderWeights.teamOnTime} suffix="%" onChange={(value) => update({ leaderWeights: { ...config.leaderWeights, teamOnTime: value } })} />
            <NumberField label="Discipline" value={config.leaderWeights.discipline} suffix="%" onChange={(value) => update({ leaderWeights: { ...config.leaderWeights, discipline: value } })} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className={styles.headRow}>
          <div>
            <h2 className={styles.title}>Work types</h2>
            <p className={styles.muted}>Effort points a task is worth. Leaders can still override a single task.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update({ workTypes: [...config.workTypes, { id: slug(`new type ${config.workTypes.length + 1}`, config.workTypes.map((type) => type.id)), name: "New work type", track: "general", effort: config.defaultEffort, active: true }] })
            }
          >
            <Plus className={styles.icon} aria-hidden />
            Add type
          </Button>
        </CardHeader>
        <CardBody className={styles.types}>
          <div className={cn(styles.typeRow, styles.typeHead)} aria-hidden>
            <span>Name</span>
            <span>Track</span>
            <span>Effort</span>
            <span>Active</span>
          </div>
          {config.workTypes.map((type, index) => (
            <div key={type.id} className={cn(styles.typeRow, !type.active && styles.inactive)}>
              <input className="input" value={type.name} aria-label="Work type name" onChange={(event) => updateType(index, { name: event.target.value })} />
              <FormSelect name={`type-track-${type.id}`} value={type.track} onValueChange={(value) => updateType(index, { track: value as ScoreTrack })} options={trackOptions} />
              <input className="input" type="number" min={0.5} max={40} step={0.5} aria-label="Effort points" value={type.effort} onChange={(event) => updateType(index, { effort: Number(event.target.value) })} />
              <label className={styles.toggle}>
                <input type="checkbox" checked={type.active} onChange={(event) => updateType(index, { active: event.target.checked })} />
                <span>{type.active ? "On" : "Off"}</span>
              </label>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <details className={styles.advanced}>
          <summary>Multipliers &amp; advanced</summary>
          <div className={styles.fields}>
            <NumberField label="PIC share" value={Math.round(config.picShare * 100)} suffix="%" min={0} max={100} onChange={(value) => update({ picShare: value / 100 })} />
            <NumberField label="Default effort" value={config.defaultEffort} step={0.5} suffix="pts" onChange={(value) => update({ defaultEffort: value })} />
            <NumberField label="Early hand-off" value={config.timeliness.early} step={0.05} suffix="×" onChange={(value) => update({ timeliness: { ...config.timeliness, early: value } })} />
            <NumberField label="On time" value={config.timeliness.onTime} step={0.05} suffix="×" onChange={(value) => update({ timeliness: { ...config.timeliness, onTime: value } })} />
            <NumberField label="1–2 days late" value={config.timeliness.late} step={0.05} suffix="×" onChange={(value) => update({ timeliness: { ...config.timeliness, late: value } })} />
            <NumberField label="3+ days late" value={config.timeliness.veryLate} step={0.05} suffix="×" onChange={(value) => update({ timeliness: { ...config.timeliness, veryLate: value } })} />
            <NumberField label="First-try approval" value={config.quality.firstTry} step={0.05} suffix="×" onChange={(value) => update({ quality: { ...config.quality, firstTry: value } })} />
            <NumberField label="Per revision" value={Math.round(config.quality.perRevision * 100)} suffix="−%" onChange={(value) => update({ quality: { ...config.quality, perRevision: value / 100 } })} />
            <NumberField label="Quality floor" value={config.quality.floor} step={0.05} suffix="×" onChange={(value) => update({ quality: { ...config.quality, floor: value } })} />
            <NumberField label="Review SLA" value={config.reviewSlaHours} suffix="h" onChange={(value) => update({ reviewSlaHours: value })} />
            <NumberField label="Output cap" value={config.outputCap} suffix="%" onChange={(value) => update({ outputCap: value })} />
            <NumberField label="Off-site penalty" value={config.offsitePenalty} suffix="pts" onChange={(value) => update({ offsitePenalty: value })} />
          </div>
        </details>
      </Card>

      <Card>
        <CardHeader>
          <h2 className={styles.title}>Manual adjustment</h2>
          <p className={styles.muted}>Adds ± points to the person&apos;s score for the current month. A reason is required and logged.</p>
        </CardHeader>
        <CardBody className={styles.adjust}>
          <form className={styles.adjustForm} onSubmit={submitAdjustment}>
            <FormSelect name="adjust_user" value={adjust.user_id} onValueChange={(value) => setAdjust({ ...adjust, user_id: value })} options={people.map((person) => ({ value: person.user_id, label: person.full_name }))} />
            <input className="input" type="number" min={-50} max={50} step={1} aria-label="Points" value={adjust.points} onChange={(event) => setAdjust({ ...adjust, points: Number(event.target.value) })} />
            <input className="input" required placeholder="Reason, e.g. covered a sick colleague's client meeting" value={adjust.reason} onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })} />
            <Button type="submit" disabled={adjusting || !adjust.reason.trim() || !adjust.points}>
              {adjusting ? <Loader2 className={styles.spin} aria-hidden /> : null}
              Apply
            </Button>
          </form>
          {adjustments.length ? (
            <ul className={styles.adjustList}>
              {adjustments.map((entry) => (
                <li key={entry.point_id}>
                  <strong className={entry.points >= 0 ? styles.plus : styles.minus}>
                    {entry.points > 0 ? "+" : ""}
                    {entry.points}
                  </strong>
                  <span>{names.get(entry.user_id) ?? entry.user_id}</span>
                  <span className={styles.muted}>{entry.reason}</span>
                  <span className={styles.muted}>{formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No adjustments yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
