"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock3,
  Layers,
  AlertCircle,
  Loader2,
  CheckSquare,
} from "lucide-react";

import { Page } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatusPill } from "@/components/ui/status-pill";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { AppData } from "@/components/app/views";
import type { TaskChecklist } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

interface ApprovalViewProps {
  data: AppData;
}

export function ApprovalView({ data }: ApprovalViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updating, setUpdating] = useState(false);

  // Local state for checklists to allow optimistic/instant updates without waiting for server reload
  const [localChecklists, setLocalChecklists] = useState<TaskChecklist[]>(data.checklists);

  useEffect(() => {
    setLocalChecklists(data.checklists);
  }, [data.checklists]);

  // Filter states
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("All");

  const userName = (id: string) => {
    return data.users.find((u) => u.user_id === id)?.full_name ?? "Unassigned";
  };

  const getTaskChecklists = (taskId: string) => {
    return localChecklists.filter((item) => item.task_id === taskId);
  };

  // 1. Toggle Assignee Completion
  const handleToggleAssignee = async (
    checklistId: string,
    currentCompleted: boolean
  ) => {
    if (updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    setLocalChecklists((prev) =>
      prev.map((c) =>
        c.checklist_id === checklistId
          ? { ...c, assignee_completed: !currentCompleted, is_completed: !currentCompleted }
          : c
      )
    );

    try {
      const formData = new FormData();
      formData.set("assignee_completed", String(!currentCompleted));

      const response = await fetch(`/api/resources/Task_Checklists/${checklistId}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to toggle assignee checklist:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 2. Toggle Leader Approval
  const handleToggleSubtask = async (
    checklistId: string,
    currentApproved: boolean,
    assigneeCompleted: boolean
  ) => {
    if (updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    setLocalChecklists((prev) =>
      prev.map((c) =>
        c.checklist_id === checklistId
          ? {
              ...c,
              pm_approved: !currentApproved,
              assignee_completed: !currentApproved ? true : c.assignee_completed,
              is_completed: !currentApproved ? true : c.is_completed,
            }
          : c
      )
    );

    try {
      const formData = new FormData();
      formData.set("pm_approved", String(!currentApproved));
      if (!currentApproved && !assigneeCompleted) {
        formData.set("assignee_completed", "true"); // Leader override completes subtask
      }

      const response = await fetch(`/api/resources/Task_Checklists/${checklistId}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to toggle subtask approval:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 3. Approve All Subtasks
  const handleApproveAll = async (taskChecklists: TaskChecklist[]) => {
    const toApprove = taskChecklists.filter((c) => !c.pm_approved);
    if (toApprove.length === 0 || updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    const toApproveIds = new Set(toApprove.map((c) => c.checklist_id));
    setLocalChecklists((prev) =>
      prev.map((c) =>
        toApproveIds.has(c.checklist_id)
          ? { ...c, pm_approved: true, assignee_completed: true, is_completed: true }
          : c
      )
    );

    try {
      await Promise.all(
        toApprove.map((c) => {
          const formData = new FormData();
          formData.set("pm_approved", "true");
          if (!c.assignee_completed) {
            formData.set("assignee_completed", "true");
          }
          return fetch(`/api/resources/Task_Checklists/${c.checklist_id}`, {
            method: "POST",
            headers: { accept: "application/json" },
            body: formData,
          });
        })
      );

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to approve all subtasks:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 4. Submit Task as Done
  const handleSubmitDone = async (taskId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/done`, {
        method: "POST",
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (error) {
      console.error("Failed to submit task as done:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Filter tasks to show only: In Progress, Waiting Approval, Ready
  const approvalCandidateTasks = data.tasks.filter((task) =>
    ["In Progress", "Waiting Approval", "Ready"].includes(task.status)
  );

  const filteredTasks = approvalCandidateTasks.filter((task) => {
    const matchStatus =
      selectedStatus === "All" ? true : task.status === selectedStatus;
    const matchProject =
      selectedProjectId === "All" || task.project_id === selectedProjectId;
    return matchStatus && matchProject;
  });

  const projectOptions = [
    { value: "All", label: "All Projects" },
    ...data.projects.map((p) => ({ value: p.project_id, label: p.project_name })),
  ];

  const statusTabs = ["All", "In Progress", "Waiting Approval", "Ready"];

  return (
    <Page>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-[2px] bg-muted p-1">
          {statusTabs.map((tab) => {
            const isActive = selectedStatus === tab;
            const count =
              tab === "All"
                ? approvalCandidateTasks.length
                : approvalCandidateTasks.filter((t) => t.status === tab).length;

            return (
              <button
                key={tab}
                onClick={() => setSelectedStatus(tab)}
                className={cn(
                  "flex items-center gap-2 rounded-[2px] px-3 py-1.5 text-xs font-normal whitespace-nowrap transition-all outline-none",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-normal tabular-nums",
                    isActive
                      ? "bg-muted text-foreground"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Project Select Filter */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-[2px] border border-border bg-card px-3 py-1.5 text-xs font-normal text-foreground outline-none focus:border-primary"
          >
            {projectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Single Column Grid of Wide Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2px] border-2 border-dashed border-border p-12 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-sm font-normal text-foreground">
            No tasks found
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            There are no approval candidate tasks matching the filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredTasks.map((task) => {
            const taskChecklists = getTaskChecklists(task.task_id);
            const needsApproval = taskNeedsLeaderApproval(task);
            const approvedCount = taskChecklists.filter((c) => c.pm_approved).length;

            const isLeaderApproved =
              !needsApproval ||
              (taskChecklists.length > 0
                ? taskChecklists.every((item) => item.pm_approved)
                : true);

            const doneDisabled = needsApproval && !isLeaderApproved;
            const project = data.projects.find(
              (p) => p.project_id === task.project_id
            );

            return (
              <article
                key={task.task_id}
                className="rounded-[2px] border border-border bg-card p-5 sm:p-6 transition hover:border-border hover:bg-muted/50"
              >
                {/* Main Card Columns */}
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6 items-start xl:items-center">
                  
                  {/* Task details column */}
                  <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <code className="rounded-[2px] bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">
                        #{task.task_id}
                      </code>
                      <Badge
                        tone={
                          task.priority === "Urgent"
                            ? "red"
                            : task.priority === "High"
                            ? "yellow"
                            : "neutral"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <Link
                      href={`/tasks/${task.task_id}`}
                      className="break-words font-normal text-[15px] leading-tight text-foreground hover:text-primary transition"
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground leading-normal">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Project Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-border pt-2 sm:pt-0">
                    <span className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">Project</span>
                    <span className="text-sm font-normal text-foreground truncate">
                      {project?.project_name ?? "No Project"}
                    </span>
                  </div>

                  {/* Date Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-border pt-2 sm:pt-0">
                    <span className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">Date</span>
                    <span className="text-sm font-normal text-foreground">
                      {task.due_date ? formatShortDate(task.due_date) : "-"}
                    </span>
                  </div>

                  {/* Assignees Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-border pt-2 sm:pt-0">
                    <span className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">Assignees</span>
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {task.assigned_to.map((id) => (
                        <Avatar
                          key={id}
                          name={userName(id)}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Status Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-border pt-2 sm:pt-0 items-start">
                    <span className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">Status</span>
                    <TaskStatusPill
                      status={task.status}
                      dueDate={task.due_date}
                      handedOffAt={task.handed_off_at}
                    />
                  </div>
                </div>

                {/* Subtasks and Report display section - side by side */}
                <div className="mt-5 pt-5 border-t border-border grid gap-5 md:grid-cols-2 items-stretch">
                  
                  {/* Left Column: Subtasks Checklists */}
                  <div className="space-y-4">
                    {taskChecklists.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-normal uppercase tracking-wider text-muted-foreground">
                          <span>Subtasks ({approvedCount}/{taskChecklists.length})</span>
                        </div>

                         <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                           {taskChecklists.map((subtask) => {
                             const assigneeDone =
                               subtask.assignee_completed || subtask.is_completed;
                             const approved = subtask.pm_approved;
                             const itemComplete = assigneeDone && (!needsApproval || approved);
 
                             return (
                               <div
                                 key={subtask.checklist_id}
                                 className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[2px] bg-muted/50 border border-border"
                               >
                                 <p
                                   className={cn(
                                     "text-xs font-normal break-words flex-1 transition-all",
                                     itemComplete
                                       ? "text-muted-foreground line-through"
                                       : "text-foreground"
                                   )}
                                 >
                                   {subtask.title}
                                 </p>
 
                                 <div className="flex items-center gap-3 shrink-0">
                                   {/* Assignee Checkbox */}
                                   <button
                                     type="button"
                                     disabled={updating || isPending}
                                     onClick={() =>
                                       handleToggleAssignee(
                                         subtask.checklist_id,
                                         assigneeDone
                                       )
                                     }
                                     className="flex items-center gap-1.5 outline-none text-xs font-normal cursor-pointer"
                                   >
                                     <span
                                       className={cn(
                                         "grid size-4 shrink-0 place-items-center rounded-[2px] border transition-all",
                                         assigneeDone
                                           ? "border-primary bg-primary text-white"
                                           : "border-border bg-card",
                                         (updating || isPending) && "opacity-50"
                                       )}
                                     >
                                       {assigneeDone ? (
                                         <Check className="size-2.5 stroke-[3]" />
                                       ) : null}
                                     </span>
                                     <span 
                                       className={cn("transition-colors", assigneeDone ? "text-primary" : "text-muted-foreground")}
                                     >
                                       Assignee
                                     </span>
                                   </button>
 
                                   {/* Leader Approved Checkbox */}
                                   {needsApproval && (
                                     <button
                                       type="button"
                                       disabled={updating || isPending || !assigneeDone}
                                       onClick={() =>
                                         handleToggleSubtask(
                                           subtask.checklist_id,
                                           approved,
                                           assigneeDone
                                         )
                                       }
                                       className={cn(
                                         "flex items-center gap-1.5 outline-none text-xs font-normal",
                                         assigneeDone ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                                       )}
                                     >
                                       <span
                                         className={cn(
                                           "grid size-4 shrink-0 place-items-center rounded-[2px] border transition-all",
                                           approved
                                             ? "text-white"
                                             : "border-border bg-card",
                                           (!assigneeDone || updating || isPending) && "opacity-50"
                                         )}
                                         style={
                                           approved
                                             ? {
                                                 backgroundColor: "#10b981",
                                                 borderColor: "#10b981",
                                               }
                                             : undefined
                                         }
                                       >
                                         {approved ? (
                                           <Check className="size-2.5 stroke-[3]" />
                                         ) : null}
                                       </span>
                                       <span 
                                         className={cn("transition-colors", approved ? "" : "text-muted-foreground")}
                                         style={approved ? { color: "#10b981" } : undefined}
                                       >
                                         Leader
                                       </span>
                                     </button>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                         </div>

                      </>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        No subtasks assigned to this task.
                      </p>
                    )}
                  </div>

                  {/* Right Column: Completion report */}
                  <div className="flex flex-col gap-1.5 h-full">
                    <p className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                      Completion Report
                    </p>
                    {task.report ? (
                      <LinkifiedText
                        text={task.report}
                        className="flex-1 rounded-[2px] border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap"
                      />
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        No report submitted yet.
                      </p>
                    )}
                  </div>

                </div>

                {/* Bottom Actions Row - aligned with the grid */}
                <div className="mt-5 pt-5 border-t border-border grid gap-5 md:grid-cols-2 items-start">
                  
                  {/* Bottom Left: Approve All Button */}
                  <div>
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      disabled={
                        updating ||
                        isPending ||
                        !needsApproval ||
                        taskChecklists.filter((c) => !c.pm_approved).length === 0
                      }
                      onClick={() => handleApproveAll(taskChecklists)}
                      className="w-full h-10 font-normal"
                    >
                      Approve All Subtasks
                    </Button>
                  </div>

                  {/* Bottom Right: Submit as Done Button */}
                  <div>
                    {updating ? (
                      <Button
                        disabled
                        variant="success"
                        size="lg"
                        className="w-full h-10 font-normal"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="success"
                        size="lg"
                        disabled={doneDisabled}
                        onClick={() => handleSubmitDone(task.task_id)}
                        className="w-full h-10 font-normal"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Submit as Done
                      </Button>
                    )}

                    {doneDisabled && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-normal text-amber-650 dark:text-amber-500 leading-tight">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        All subtasks must be approved by the leader first.
                      </p>
                    )}
                  </div>

                </div>

              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
