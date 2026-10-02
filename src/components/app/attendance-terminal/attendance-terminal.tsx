"use client";

import { CheckCircle2, Coffee, Loader2, LogIn, MapPin, Play, SquareCheckBig, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import styles from "./attendance-terminal.module.css";

type AttendanceEventType = "clock_in" | "transit_pause" | "resume" | "clock_out";
type AttendanceMode = "none" | "working" | "paused" | "closed";

interface AttendanceSessionRecord {
  id: string;
  user_id: string;
  date: string;
  status: "On Time" | "Late" | "Present" | "Leave" | "System Auto-Closed";
  total_active_minutes: number;
  eod_summary: string | null;
  work_mode?: "WFO" | "WFH" | "Off-site" | null;
  base_distance_m?: number | null;
  created_at: string;
}

type EodTask = { task_id: string; title: string; status: string; project: string };

interface AttendanceEventRecord {
  id: string;
  session_id: string;
  event_type: AttendanceEventType;
  lat: number;
  lng: number;
  timestamp: string;
}

interface AttendanceTerminalState {
  session: AttendanceSessionRecord | null;
  events: AttendanceEventRecord[];
  state: AttendanceMode;
  activeMinutes: number;
  lastEvent: AttendanceEventRecord | null;
}

interface AttendanceTerminalProps {
  className?: string;
}

interface PlaceLinkState {
  label: string;
  url: string;
}

const eventLabels: Record<AttendanceEventType, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  resume: "Resume work",
  transit_pause: "Transit / break pause",
};

function getPositionSnapshot() {
  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => reject(new Error(error.message || "Unable to acquire secure location.")),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  });
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed with HTTP ${response.status}.`;
  } catch {
    return `Request failed with HTTP ${response.status}.`;
  }
}

/** Active seconds up to `now`: clock-in/resume start a stretch, pause/clock-out end it (mirrors the server). */
function activeSeconds(events: AttendanceEventRecord[], now: number) {
  let total = 0;
  let startedAt: number | null = null;
  for (const event of [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    const at = Date.parse(event.timestamp);
    if ((event.event_type === "clock_in" || event.event_type === "resume") && startedAt === null) startedAt = at;
    if ((event.event_type === "transit_pause" || event.event_type === "clock_out") && startedAt !== null) {
      total += at - startedAt;
      startedAt = null;
    }
  }
  if (startedAt !== null) total += now - startedAt;
  return Math.max(0, Math.floor(total / 1000));
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatEventTime(timestamp: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(timestamp));
}

function statusTone(status?: AttendanceSessionRecord["status"]) {
  if (status === "On Time" || status === "Present") return "green";
  if (status === "Late") return "yellow";
  if (status === "System Auto-Closed") return "red";
  return "neutral";
}

function stateLabel(state: AttendanceMode) {
  if (state === "working") return "Working";
  if (state === "paused") return "Paused";
  if (state === "closed") return "Closed";
  return "Ready";
}

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function PlaceLink({ event }: { event: AttendanceEventRecord }) {
  const fallback = useMemo<PlaceLinkState>(
    () => ({
      label: "Open in Google Maps",
      url: googleMapsUrl(event.lat, event.lng),
    }),
    [event.lat, event.lng],
  );
  const [place, setPlace] = useState<PlaceLinkState | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolvePlace() {
      try {
        const params = new URLSearchParams({
          lat: String(event.lat),
          lng: String(event.lng),
        });
        const response = await fetch(`/api/location/reverse?${params.toString()}`, {
          cache: "force-cache",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const body = (await response.json()) as { data?: PlaceLinkState };
        if (isMounted && body.data?.url && body.data.label) {
          setPlace(body.data);
        }
      } catch {
        if (isMounted) setPlace(null);
      }
    }

    void resolvePlace();

    return () => {
      isMounted = false;
    };
  }, [event.lat, event.lng, fallback]);

  const resolvedPlace = place ?? fallback;

  return (
    <a className={styles.link} href={resolvedPlace.url} target="_blank" rel="noreferrer" title="Open attendance location in Google Maps">
      <MapPin className={styles.iconSm} />
      {resolvedPlace.label}
    </a>
  );
}

export function AttendanceTerminal({ className }: AttendanceTerminalProps) {
  const router = useRouter();
  const [terminal, setTerminal] = useState<AttendanceTerminalState | null>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [eodSummary, setEodSummary] = useState("");
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("Loading attendance terminal...");
  const [now, setNow] = useState(() => Date.now());
  const [eodTasks, setEodTasks] = useState<EodTask[] | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskQuery, setTaskQuery] = useState("");

  const isBusy = Boolean(loadingLabel);
  // A summary of 20+ characters, or at least one task ticked, is enough to clock out.
  const eodIsValid = eodSummary.trim().length >= 20 || selectedTasks.length > 0;
  const working = terminal?.state === "working";

  // Keep the active-time counter running every second while working.
  useEffect(() => {
    if (!working) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  useEffect(() => {
    let isMounted = true;

    async function fetchTerminalState() {
      try {
        const response = await fetch("/api/attendance/log-event", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const body = (await response.json()) as { data: AttendanceTerminalState };
        if (isMounted) setTerminal(body.data);
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load attendance terminal.");
        }
      } finally {
        if (isMounted) setLoadingLabel("");
      }
    }

    void fetchTerminalState();

    return () => {
      isMounted = false;
    };
  }, []);

  const latestLocation = terminal?.lastEvent;

  async function submitEvent(eventType: AttendanceEventType, summary?: string) {
    setError("");
    setLoadingLabel("Acquiring secure location...");

    try {
      const coords = await getPositionSnapshot();
      setLoadingLabel("Saving attendance event...");

      const response = await fetch("/api/attendance/log-event", {
        body: JSON.stringify({
          eod_summary: summary,
          eod_task_ids: eventType === "clock_out" ? selectedTasks : undefined,
          event_type: eventType,
          lat: coords.latitude,
          lng: coords.longitude,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as { data: AttendanceTerminalState };
      setTerminal(body.data);
      router.refresh();

      if (eventType === "clock_out") {
        setClockOutOpen(false);
        setEodSummary("");
        setSelectedTasks([]);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save attendance event.");
    } finally {
      setLoadingLabel("");
    }
  }

  function requestClockOut() {
    setError("");
    setClockOutOpen(true);
    if (eodTasks === null) {
      fetch("/api/me/eod-tasks", { headers: { Accept: "application/json" } })
        .then((response) => (response.ok ? response.json() : { data: [] }))
        .then((body: { data?: EodTask[] }) => setEodTasks(body.data ?? []))
        .catch(() => setEodTasks([]));
    }
  }

  function toggleTask(taskId: string) {
    setSelectedTasks((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  function confirmClockOut() {
    if (!eodIsValid) {
      setError("Write at least 20 characters or tick the tasks you worked on.");
      return;
    }
    const picked = (eodTasks ?? []).filter((task) => selectedTasks.includes(task.task_id));
    const taskLines = picked.map((task) => `• [${task.task_id}] ${task.title}`).join("\n");
    const summary = [eodSummary.trim(), taskLines ? `Tasks worked on:\n${taskLines}` : ""].filter(Boolean).join("\n\n");
    void submitEvent("clock_out", summary);
  }

  const state = terminal?.state ?? "none";
  const session = terminal?.session;

  return (
    <>
      <Card className={cn(styles.terminal, className)}>
        <CardHeader>
          <div className={styles.statusRow}>
            <div>
              <p className={styles.eyebrow}>Secure attendance</p>
              <h2 className={styles.title}>Attendance Terminal</h2>
              <p className={styles.subtitle}>Every action captures a fresh location snapshot and uses server time for the final attendance record.</p>
            </div>
            <div className={styles.badges}>
              {session?.work_mode ? (
                <Badge tone={session.work_mode === "WFO" ? "green" : session.work_mode === "WFH" ? "blue" : "red"}>
                  {session.work_mode}
                  {session.work_mode === "Off-site" && typeof session.base_distance_m === "number" ? ` · ${(session.base_distance_m / 1000).toFixed(1)} km` : ""}
                </Badge>
              ) : null}
              <Badge tone={statusTone(session?.status)}>{session?.status ?? stateLabel(state)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardBody className={styles.hero}>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>State</p>
              <p className={styles.metricValue}>{stateLabel(state)}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Active time</p>
              <p className={styles.metricValue}>
                {terminal?.events.length ? formatSeconds(activeSeconds(terminal.events, now)) : formatMinutes(session?.total_active_minutes ?? 0)}
              </p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Location</p>
              <div className={styles.metricValue}>
                {latestLocation ? <PlaceLink event={latestLocation} /> : "No secure location recorded yet"}
              </div>
            </div>
          </div>

          <div className={cn(styles.actions, state === "none" || state === "paused" || state === "closed" ? styles.actionsSingle : undefined)}>
            {state === "none" ? (
              <Button type="button" size="xl" className={styles.button} disabled={isBusy} onClick={() => void submitEvent("clock_in")}>
                {isBusy ? <Loader2 className={cn(styles.icon, styles.spinner)} /> : <LogIn className={styles.icon} />}
                Clock In
              </Button>
            ) : null}

            {state === "working" ? (
              <>
                <Button type="button" variant="warning" size="xl" className={cn(styles.button, styles.pauseAction)} disabled={isBusy} onClick={() => void submitEvent("transit_pause")}>
                  {isBusy ? <Loader2 className={cn(styles.icon, styles.spinner)} /> : <Coffee className={styles.icon} />}
                  Pause (Transit/Break)
                </Button>
                <Button type="button" variant="destructiveOutline" size="xl" className={cn(styles.button, styles.clockOutAction)} disabled={isBusy} onClick={requestClockOut}>
                  <SquareCheckBig className={styles.icon} />
                  Clock Out
                </Button>
              </>
            ) : null}

            {state === "paused" ? (
              <Button type="button" size="xl" className={styles.button} disabled={isBusy} onClick={() => void submitEvent("resume")}>
                {isBusy ? <Loader2 className={cn(styles.icon, styles.spinner)} /> : <Play className={styles.icon} />}
                Resume Work
              </Button>
            ) : null}

            {state === "closed" ? (
              <div className={styles.closedState}>
                <CheckCircle2 className={styles.icon} />
                Shift complete
              </div>
            ) : null}
          </div>

          {loadingLabel ? (
            <div className={styles.message} role="status">
              <Loader2 className={cn(styles.icon, styles.spinner)} />
              {loadingLabel}
            </div>
          ) : null}

          {error ? (
            <div className={cn(styles.message, styles.error)} role="alert">
              {error}
            </div>
          ) : null}

          <div className={styles.timeline}>
            <p className={styles.timelineTitle}>Today event log</p>
            {terminal && terminal.events.length > 0 ? (
              <div className={styles.timelineList}>
                {terminal.events.slice(-5).map((event) => (
                  <div key={event.id} className={styles.timelineItem}>
                    <span className={styles.dot} />
                    <div>
                      <p className={styles.eventTitle}>{eventLabels[event.event_type]}</p>
                      <p className={styles.eventMeta}>
                        {formatEventTime(event.timestamp)} · <PlaceLink event={event} />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No attendance event has been logged today.</div>
            )}
          </div>
        </CardBody>
      </Card>

      {clockOutOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="attendance-eod-title">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3 id="attendance-eod-title" className={styles.modalTitle}>
                  End of Day Summary
                </h3>
                <p className={styles.modalCopy}>Write what was completed today before closing the session.</p>
              </div>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Close clock out summary" disabled={isBusy} onClick={() => setClockOutOpen(false)}>
                <X className={styles.icon} />
              </Button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.taskPicker}>
                <div className={styles.taskPickerHead}>
                  <span className={styles.label}>Tasks you worked on today</span>
                  <span className={styles.characterCount}>{selectedTasks.length} selected</span>
                </div>
                {eodTasks === null ? (
                  <p className={styles.characterCount}>Loading your tasks…</p>
                ) : eodTasks.length === 0 ? (
                  <p className={styles.characterCount}>No tasks assigned to you.</p>
                ) : (
                  <>
                    {eodTasks.length > 6 ? (
                      <input className="input" placeholder="Search tasks" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} />
                    ) : null}
                    <ul className={styles.taskList}>
                      {eodTasks
                        .filter((task) => !taskQuery.trim() || `${task.task_id} ${task.title} ${task.project}`.toLowerCase().includes(taskQuery.trim().toLowerCase()))
                        .map((task) => (
                          <li key={task.task_id}>
                            <label className={styles.taskOption}>
                              <input type="checkbox" checked={selectedTasks.includes(task.task_id)} onChange={() => toggleTask(task.task_id)} />
                              <span className={styles.taskText}>
                                <span className={styles.taskTitle}>{task.title}</span>
                                <span className={styles.characterCount}>
                                  {task.task_id}
                                  {task.project ? ` · ${task.project}` : ""} · {task.status}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
              <label className={styles.label} htmlFor="attendance-eod-summary">
                Summary {selectedTasks.length ? <span className={styles.characterCount}>(optional when tasks are ticked)</span> : <span className={styles.required}>*</span>}
              </label>
              <textarea
                id="attendance-eod-summary"
                className={cn("input", styles.input)}
                value={eodSummary}
                onChange={(event) => setEodSummary(event.target.value)}
                placeholder="Summarize completed work, blockers, and any handoff notes."
              />
              <p className={styles.characterCount}>{selectedTasks.length ? "Ticked tasks are added to your summary." : `${eodSummary.trim().length}/20 characters minimum`}</p>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" size="xl" className={styles.button} disabled={isBusy} onClick={() => setClockOutOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="xl" className={styles.button} disabled={isBusy || !eodIsValid} onClick={confirmClockOut}>
                  {isBusy ? <Loader2 className={cn(styles.icon, styles.spinner)} /> : <MapPin className={styles.icon} />}
                  Submit Clock Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
