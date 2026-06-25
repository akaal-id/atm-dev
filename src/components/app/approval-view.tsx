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
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/50">
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
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all outline-none",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {tab}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    isActive
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-200"
                      : "bg-slate-200/60 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
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
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-purple-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
          <CheckSquare className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            No tasks found
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:bg-slate-900/20"
              >
                {/* Main Card Columns */}
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6 items-start xl:items-center">
                  
                  {/* Task details column */}
                  <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-450">
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
                      className="break-words font-extrabold text-[15px] leading-tight text-slate-950 hover:text-blue-600 dark:text-slate-100 transition"
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="mt-1 line-clamp-1 text-[13px] text-slate-500 leading-normal">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Project Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 dark:border-slate-850">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Project</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {project?.project_name ?? "No Project"}
                    </span>
                  </div>

                  {/* Date Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 dark:border-slate-850">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Date</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {task.due_date ? formatShortDate(task.due_date) : "-"}
                    </span>
                  </div>

                  {/* Assignees Cell */}
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 dark:border-slate-850">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Assignees</span>
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
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 items-start dark:border-slate-850">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Status</span>
                    <TaskStatusPill
                      status={task.status}
                      dueDate={task.due_date}
                      handedOffAt={task.handed_off_at}
                    />
                  </div>
                </div>

                {/* Subtasks and Report display section - side by side */}
                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid gap-5 md:grid-cols-2 items-stretch">
                  
                  {/* Left Column: Subtasks Checklists */}
                  <div className="space-y-4">
                    {taskChecklists.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
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
                                 className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800"
                               >
                                 <p
                                   className={cn(
                                     "text-xs font-semibold break-words flex-1 transition-all",
                                     itemComplete
                                       ? "text-slate-400 line-through dark:text-slate-500"
                                       : "text-slate-800 dark:text-slate-200"
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
                                     className="flex items-center gap-1.5 outline-none text-xs font-semibold cursor-pointer"
                                   >
                                     <span
                                       className={cn(
                                         "grid size-4 shrink-0 place-items-center rounded border transition-all",
                                         assigneeDone
                                           ? "text-white"
                                           : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800",
                                         (updating || isPending) && "opacity-50"
                                       )}
                                       style={
                                         assigneeDone
                                           ? {
                                               backgroundColor: "#6d28d9",
                                               borderColor: "#6d28d9",
                                             }
                                           : undefined
                                       }
                                     >
                                       {assigneeDone ? (
                                         <Check className="size-2.5 stroke-[3]" />
                                       ) : null}
                                     </span>
                                     <span 
                                       className={cn("transition-colors", assigneeDone ? "" : "text-slate-500")}
                                       style={assigneeDone ? { color: "#6d28d9" } : undefined}
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
                                         "flex items-center gap-1.5 outline-none text-xs font-semibold",
                                         assigneeDone ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                                       )}
                                     >
                                       <span
                                         className={cn(
                                           "grid size-4 shrink-0 place-items-center rounded border transition-all",
                                           approved
                                             ? "text-white"
                                             : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800",
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
                                         className={cn("transition-colors", approved ? "" : "text-slate-500")}
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
                      <p className="text-xs italic text-slate-400">
                        No subtasks assigned to this task.
                      </p>
                    )}
                  </div>

                  {/* Right Column: Completion report */}
                  <div className="flex flex-col gap-1.5 h-full">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Completion Report
                    </p>
                    {task.report ? (
                      <LinkifiedText
                        text={task.report}
                        className="flex-1 rounded border border-slate-200 bg-slate-50/50 dark:bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-750 dark:text-slate-300 whitespace-pre-wrap"
                      />
                    ) : (
                      <p className="text-xs italic text-slate-400">
                        No report submitted yet.
                      </p>
                    )}
                  </div>

                </div>

                {/* Bottom Actions Row - aligned with the grid */}
                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid gap-5 md:grid-cols-2 items-start">
                  
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
                      className="w-full h-10 font-semibold"
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
                        className="w-full h-10 font-semibold"
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
                        className="w-full h-10 font-semibold"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Submit as Done
                      </Button>
                    )}

                    {doneDisabled && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-650 dark:text-amber-500 leading-tight">
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
